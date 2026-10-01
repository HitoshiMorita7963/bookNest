import { NextResponse } from "next/server";
import { saveImage, type ImageKind } from "@/server/services/images";
import { toUserError } from "@/lib/errors";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_UPLOAD_BYTES * 1.2) {
      return NextResponse.json({ ok: false, error: "画像サイズが大きすぎます" }, { status: 413 });
    }
    const form = await req.formData();
    const file = form.get("file");
    const kindRaw = String(form.get("kind") ?? "misc");
    const kind: ImageKind = kindRaw === "cover" || kindRaw === "quote" ? kindRaw : "misc";
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "画像が選択されていません" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await saveImage(buf, file.type || "application/octet-stream", kind);
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    const r = toUserError(e);
    return NextResponse.json(r, { status: r.code === "INTERNAL" ? 500 : 400 });
  }
}
