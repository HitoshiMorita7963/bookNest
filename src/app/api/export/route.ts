import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { exportCsv, exportJson } from "@/server/services/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fmt = url.searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = format(new Date(), "yyyyMMdd-HHmm");
  try {
    if (fmt === "json") {
      const data = await exportJson(prisma, { includeAi: url.searchParams.get("ai") === "1" });
      return new Response(JSON.stringify(data, null, 1), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="booknest-backup-${stamp}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const t = url.searchParams.get("type");
    const type = t === "records" || t === "quotes" ? t : "books";
    const csv = await exportCsv(prisma, type);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="booknest-${type}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[export]", e);
    return new Response("エクスポートに失敗しました", { status: 500 });
  }
}
