"use client";

/**
 * OCRService
 * OCR エンジンを抽象化し、設定に応じて切り替える。
 *  - tesseract     : 端末内（ブラウザ）で処理。画像は外部に送信されない（既定）
 *  - server        : /api/ocr 経由でサーバー側エンジン（Google Cloud Vision 等）を利用
 * 新しいエンジンは OcrEngine を実装して ENGINES に追加する。
 */
import { cleanOcrText } from "./text";
import { downscaleImage } from "@/lib/client/image";

export type OcrDirection = "horizontal" | "vertical";

export interface OcrOptions {
  direction: OcrDirection;
  /** 英数字を多く含む場合 true（英語モデルを併用） */
  withEnglish?: boolean;
  onProgress?: (p: { status: string; progress: number }) => void;
}

export interface OcrResult {
  text: string;
  confidence: number | null;
  engine: string;
}

export interface OcrEngine {
  name: string;
  recognize(image: Blob, opts: OcrOptions): Promise<{ text: string; confidence: number | null }>;
}

const STATUS_JA: Record<string, string> = {
  "loading tesseract core": "OCRエンジンを準備しています",
  "initializing tesseract": "OCRエンジンを初期化しています",
  "loading language traineddata": "日本語データを読み込んでいます（初回のみ時間がかかります）",
  "initializing api": "準備しています",
  "recognizing text": "文字を認識しています",
};

/* ---------- Tesseract.js（端末内処理） ---------- */
type TWorker = Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
const workers = new Map<string, Promise<TWorker>>();
let progressHandler: OcrOptions["onProgress"];

async function getWorker(langs: string[]): Promise<TWorker> {
  const key = langs.join("+");
  if (!workers.has(key)) {
    workers.set(
      key,
      (async () => {
        const { createWorker } = await import("tesseract.js");
        return createWorker(langs, 1, {
          logger: (m) => progressHandler?.({ status: STATUS_JA[m.status] ?? m.status, progress: m.progress }),
        });
      })().catch((e) => {
        workers.delete(key);
        throw e;
      }),
    );
  }
  return workers.get(key)!;
}

export const tesseractEngine: OcrEngine = {
  name: "tesseract",
  async recognize(image, opts) {
    progressHandler = opts.onProgress;
    const base = opts.direction === "vertical" ? "jpn_vert" : "jpn";
    const langs = opts.withEnglish ? [base, "eng"] : [base];
    const worker = await getWorker(langs);
    await worker.setParameters({
      // 縦書き：縦に並んだ一様なテキストブロック(5) / 横書き：一様なテキストブロック(6)
      tessedit_pageseg_mode: (opts.direction === "vertical" ? "5" : "6") as never,
      preserve_interword_spaces: "1",
    });
    const { data } = await worker.recognize(image);
    return { text: data.text, confidence: typeof data.confidence === "number" ? data.confidence : null };
  },
};

/* ---------- サーバー側エンジン ---------- */
export const serverEngine: OcrEngine = {
  name: "server",
  async recognize(image, opts) {
    opts.onProgress?.({ status: "サーバーで文字を認識しています", progress: 0.3 });
    // サーバーへの送信サイズを抑える（クラウドのリクエスト上限対策）
    const upload = image.size > 2_500_000 ? await downscaleImage(image, 2400, 0.9) : image;
    const fd = new FormData();
    fd.append("file", new File([upload], "ocr.jpg", { type: upload.type || "image/jpeg" }));
    fd.append("direction", opts.direction);
    const res = await fetch("/api/ocr", { method: "POST", body: fd });
    const json = (await res.json().catch(() => null)) as { ok: boolean; text?: string; confidence?: number; error?: string } | null;
    if (!json?.ok) throw new Error(json?.error ?? "OCRに失敗しました");
    opts.onProgress?.({ status: "完了", progress: 1 });
    return { text: json.text ?? "", confidence: json.confidence ?? null };
  },
};

const ENGINES: Record<string, OcrEngine> = { tesseract: tesseractEngine, server: serverEngine };

export async function getOcrEngineName(): Promise<string> {
  try {
    const local = localStorage.getItem("booknest.ocrEngine");
    if (local && ENGINES[local]) return local;
  } catch {
    /* storage 無効時は既定 */
  }
  try {
    const res = await fetch("/api/ocr");
    const json = (await res.json()) as { serverAvailable: boolean; defaultEngine: string };
    return json.defaultEngine === "server" && json.serverAvailable ? "server" : "tesseract";
  } catch {
    return "tesseract";
  }
}

export async function recognizeText(image: Blob, opts: OcrOptions & { joinLines?: boolean; engine?: string }): Promise<OcrResult> {
  const name = opts.engine ?? (await getOcrEngineName());
  const engine = ENGINES[name] ?? tesseractEngine;
  try {
    const r = await engine.recognize(image, opts);
    return { text: cleanOcrText(r.text, { joinLines: opts.joinLines }), confidence: r.confidence, engine: engine.name };
  } catch (e) {
    console.error("[OCR]", e);
    if (!navigator.onLine) throw new Error("オフラインのため OCR エンジンを読み込めませんでした。初回はネットワーク接続が必要です。");
    throw new Error("文字を読み取れませんでした。範囲を調整するか、再度お試しください。");
  }
}
