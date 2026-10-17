import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { manuscriptFileName, manuscriptText } from "@/lib/manuscript";
import { getManuscript, manuscriptDocx } from "@/server/services/manuscript";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 原稿のダウンロード：?format=docx（Word・Google ドキュメント）| txt、&titles=0 でシーン名を入れない */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "txt" ? "txt" : "docx";
  const opts = { sceneTitles: url.searchParams.get("titles") !== "0" };
  try {
    const ms = await getManuscript(prisma, id);
    const name = manuscriptFileName(ms.title, format);
    // 日本語のファイル名は filename* で渡す（filename は古いブラウザ向けの代わり）
    const disposition = `attachment; filename="manuscript.${format}"; filename*=UTF-8''${encodeURIComponent(name)}`;
    if (format === "txt") {
      return new Response(manuscriptText(ms, opts), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": disposition, "Cache-Control": "no-store" },
      });
    }
    const file = await manuscriptDocx(ms, opts);
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": disposition, "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof NotFoundError) return Response.json({ ok: false, error: e.message }, { status: 404 });
    throw e;
  }
}
