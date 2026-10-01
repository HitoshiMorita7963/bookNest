"use client";

/**
 * ImagePreprocessService
 * 撮影画像を切り抜き・回転し、OCR 精度が上がるよう前処理する。
 */

export interface CropRect {
  /** 0〜100 の割合 */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 画像を回転（90度単位）してキャンバスに描画 */
export function rotateImage(img: HTMLImageElement | ImageBitmap, rotation: number): HTMLCanvasElement {
  const r = ((rotation % 360) + 360) % 360;
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement("canvas");
  const swap = r === 90 || r === 270;
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2);
  return canvas;
}

/** 割合指定の範囲で切り抜く */
export function cropCanvas(source: HTMLCanvasElement, crop: CropRect | null): HTMLCanvasElement {
  if (!crop || crop.width <= 0 || crop.height <= 0) return source;
  const sx = Math.round((crop.x / 100) * source.width);
  const sy = Math.round((crop.y / 100) * source.height);
  const sw = Math.max(1, Math.round((crop.width / 100) * source.width));
  const sh = Math.max(1, Math.round((crop.height / 100) * source.height));
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  out.getContext("2d")!.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

/**
 * OCR 用の前処理：
 *  - 文字が小さい場合は拡大（短辺 1000px 程度を目標）
 *  - グレースケール化
 *  - コントラストの自動調整（明るさの 2%〜98% を引き伸ばす）
 */
export function enhanceForOcr(source: HTMLCanvasElement, opts: { binarize?: boolean } = {}): HTMLCanvasElement {
  const minSide = Math.min(source.width, source.height);
  const maxSide = Math.max(source.width, source.height);
  let scale = minSide < 900 ? Math.min(3, 900 / minSide) : 1;
  if (maxSide * scale > 4000) scale = 4000 / maxSide;
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const hist = new Uint32Array(256);
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    gray[j] = g;
    hist[gray[j]]++;
  }
  const total = w * h;
  let lo = 0;
  let hi = 255;
  for (let acc = 0, v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      lo = v;
      break;
    }
  }
  for (let acc = 0, v = 255; v >= 0; v--) {
    acc += hist[v];
    if (acc >= total * 0.02) {
      hi = v;
      break;
    }
  }
  const range = Math.max(1, hi - lo);
  let threshold = 128;
  if (opts.binarize) threshold = otsu(hist, total);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    let v = ((gray[j] - lo) * 255) / range;
    if (opts.binarize) v = gray[j] > threshold ? 255 : 0;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

function otsu(hist: Uint32Array, total: number) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > max) {
      max = between;
      threshold = t;
    }
  }
  return threshold;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("画像の変換に失敗しました"))), type, quality));
}

/** 保存用に縮小 */
export function downscaleCanvas(source: HTMLCanvasElement, maxSide = 1600): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  if (scale === 1) return source;
  const c = document.createElement("canvas");
  c.width = Math.round(source.width * scale);
  c.height = Math.round(source.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

/**
 * 文字の向きを推定する（投影プロファイル法）。
 * 横書きは行間に「インクの無い行」が、縦書きは列間に「インクの無い列」が多く現れることを利用する。
 */
export function detectDirection(source: HTMLCanvasElement): "horizontal" | "vertical" {
  const scale = Math.min(1, 400 / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  let sum = 0;
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    gray[j] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    sum += gray[j];
  }
  const mean = sum / gray.length;
  const threshold = mean * 0.75; // 背景より十分暗い画素を「インク」とみなす
  const rows = new Uint32Array(h);
  const cols = new Uint32Array(w);
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (gray[y * w + x] < threshold) {
        rows[y]++;
        cols[x]++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return source.height > source.width * 1.15 ? "vertical" : "horizontal";
  // 文字領域内での「空白行」「空白列」の割合を比較
  let blankRows = 0;
  for (let y = minY; y <= maxY; y++) if (rows[y] <= 1) blankRows++;
  let blankCols = 0;
  for (let x = minX; x <= maxX; x++) if (cols[x] <= 1) blankCols++;
  const rowRatio = blankRows / (maxY - minY + 1);
  const colRatio = blankCols / (maxX - minX + 1);
  return colRatio > rowRatio * 1.2 ? "vertical" : "horizontal";
}
