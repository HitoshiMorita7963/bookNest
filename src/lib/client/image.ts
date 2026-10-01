"use client";

/** 端末側で画像を縮小・圧縮してからアップロードする（通信量と保存容量の削減） */
export async function downscaleImage(file: Blob, maxDim = 2000, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("画像を読み込めませんでした"));
    img.src = src;
  });
}

export async function uploadImage(blob: Blob, kind: "cover" | "quote" | "misc"): Promise<string> {
  const fd = new FormData();
  fd.append("file", new File([blob], "image.jpg", { type: blob.type || "image/jpeg" }));
  fd.append("kind", kind);
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body: fd });
  } catch {
    throw new Error("通信に失敗しました。ネットワーク接続を確認してください。");
  }
  const json = (await res.json().catch(() => null)) as { ok: boolean; url?: string; error?: string } | null;
  if (!json?.ok || !json.url) throw new Error(json?.error ?? "画像のアップロードに失敗しました");
  return json.url;
}
