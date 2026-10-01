/**
 * サーバー側 OCR（任意）
 * OCR_PROVIDER=google-vision かつ OCR_API_KEY が設定されている場合のみ有効。
 * 既定は端末内処理（tesseract.js）のため、このエンドポイントは利用されない。
 */
import { NextResponse } from "next/server";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";

export const runtime = "nodejs";

function serverAvailable() {
  return process.env.OCR_PROVIDER === "google-vision" && !!process.env.OCR_API_KEY;
}

export async function GET() {
  return NextResponse.json({ serverAvailable: serverAvailable(), defaultEngine: serverAvailable() ? "server" : "tesseract" });
}

export async function POST(req: Request) {
  if (!serverAvailable()) {
    return NextResponse.json({ ok: false, error: "サーバーOCRは設定されていません" }, { status: 400 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "画像がありません" }, { status: 400 });
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: "画像の形式またはサイズが正しくありません" }, { status: 400 });
    }
    const content = Buffer.from(await file.arrayBuffer()).toString("base64");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(process.env.OCR_API_KEY!)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        requests: [{ image: { content }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }], imageContext: { languageHints: ["ja", "en"] } }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error("[ocr] vision api status", res.status);
      return NextResponse.json({ ok: false, error: "OCRサービスでエラーが発生しました" }, { status: 502 });
    }
    const json = (await res.json()) as { responses?: { fullTextAnnotation?: { text?: string; pages?: { confidence?: number }[] } }[] };
    const ann = json.responses?.[0]?.fullTextAnnotation;
    const conf = ann?.pages?.[0]?.confidence;
    return NextResponse.json({ ok: true, text: ann?.text ?? "", confidence: conf != null ? Math.round(conf * 100) : null });
  } catch (e) {
    console.error("[ocr]", e);
    return NextResponse.json({ ok: false, error: "OCRに失敗しました。時間をおいて再度お試しください。" }, { status: 500 });
  }
}
