/**
 * ImageStorageService
 * アップロード画像を検証・リサイズ・圧縮して保存する。
 * 保存先：BLOB_READ_WRITE_TOKEN があれば Vercel Blob（非公開）、なければローカルの data/uploads。
 * どちらの場合も画像は /api/files/<name> 経由で配信する（ログインが必要）。
 */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { del as blobDel, get as blobGet, put as blobPut } from "@vercel/blob";
import { AppError } from "@/lib/errors";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const FILE_NAME_RE = /^[a-z]+-[0-9a-f-]{36}\.webp$/;

export type ImageKind = "cover" | "quote" | "misc";

const PRESETS: Record<ImageKind, { maxW: number; maxH: number; quality: number }> = {
  cover: { maxW: 600, maxH: 900, quality: 80 },
  // OCR 用の元画像は文字が読める程度の解像度を保つ
  quote: { maxW: 1600, maxH: 1600, quality: 72 },
  misc: { maxW: 1200, maxH: 1200, quality: 78 },
};

export async function saveImage(buffer: Buffer, mime: string, kind: ImageKind = "misc"): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
    throw new AppError("対応していない画像形式です（JPEG / PNG / WebP / HEIC）", "VALIDATION");
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new AppError(`画像サイズが大きすぎます（最大 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB）`, "VALIDATION");
  }
  const preset = PRESETS[kind];
  let out: Buffer;
  try {
    // sharp が実際に画像としてデコードできるか検証（拡張子偽装対策）
    const meta = await sharp(buffer, { failOn: "error", limitInputPixels: 60_000_000 }).metadata();
    if (!meta.width || !meta.height) throw new Error("invalid image");
    out = await sharp(buffer, { failOn: "error", limitInputPixels: 60_000_000 })
      .rotate() // EXIF の向きを反映
      .resize({ width: preset.maxW, height: preset.maxH, fit: "inside", withoutEnlargement: true })
      .webp({ quality: preset.quality })
      .toBuffer();
  } catch {
    throw new AppError("画像を読み込めませんでした。別の画像でお試しください。", "IMAGE_ERROR");
  }
  const name = `${kind}-${randomUUID()}.webp`;
  if (blobStorageEnabled()) {
    await blobPut(`uploads/${name}`, out, { access: "private", contentType: "image/webp", addRandomSuffix: false });
  } else {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), out);
  }
  return `/api/files/${name}`;
}

function blobStorageEnabled() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

export function isSafeFileName(name: string) {
  return FILE_NAME_RE.test(name);
}

export async function readImage(name: string): Promise<Buffer | null> {
  if (!isSafeFileName(name)) return null;
  try {
    if (blobStorageEnabled()) {
      const r = await blobGet(`uploads/${name}`, { access: "private" });
      if (!r) return null;
      return Buffer.from(await new Response(r.stream).arrayBuffer());
    }
    return await readFile(path.join(UPLOAD_DIR, name));
  } catch {
    return null;
  }
}

export async function deleteImageByUrl(url: string | null | undefined) {
  if (!url?.startsWith("/api/files/")) return;
  const name = url.slice("/api/files/".length);
  if (!isSafeFileName(name)) return;
  if (blobStorageEnabled()) await blobDel(`uploads/${name}`).catch(() => undefined);
  else await unlink(path.join(UPLOAD_DIR, name)).catch(() => undefined);
}

/** 外部 URL の書影を取得してローカル保存（オフライン表示用） */
export async function fetchRemoteImage(url: string, kind: ImageKind = "cover"): Promise<string | null> {
  if (!/^https:\/\//.test(url)) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await saveImage(buf, ALLOWED_IMAGE_TYPES.includes(type) ? type : "image/jpeg", kind);
  } catch {
    return null;
  }
}
