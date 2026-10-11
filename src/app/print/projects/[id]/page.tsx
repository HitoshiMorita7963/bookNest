import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { manuscriptStats, writtenChapters } from "@/lib/manuscript";
import { getManuscript } from "@/server/services/manuscript";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/manuscript/print-button";
import { ManuscriptBody } from "@/components/manuscript/manuscript-body";
import { MANUSCRIPT_CSS } from "@/components/manuscript/manuscript-css";

export const metadata = { title: "原稿" };

/**
 * 原稿ビュー：章・シーンの本文を1つにまとめて表示する。
 * 印刷（PDF に保存）するとツールバーは消え、原稿だけが A5 の紙に並ぶ。縦書きにもできる。
 */
export default async function ManuscriptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dir?: string; titles?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const vertical = sp.dir === "v";
  const sceneTitles = sp.titles !== "0";
  const ms = await getManuscript(prisma, id).catch(() => null);
  if (!ms) notFound();
  const chapters = writtenChapters(ms);
  const stats = manuscriptStats(ms);
  const q = (next: { dir?: string; titles?: string }) => {
    const p = new URLSearchParams({ ...(vertical ? { dir: "v" } : {}), ...(sceneTitles ? {} : { titles: "0" }), ...next });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    const s = p.toString();
    return `/print/projects/${id}${s ? `?${s}` : ""}`;
  };
  const download = (format: string) => `/api/projects/${id}/manuscript?format=${format}${sceneTitles ? "" : "&titles=0"}`;

  return (
    <div className="min-h-dvh bg-muted/40 print:bg-white">
      <style>{MANUSCRIPT_CSS}</style>
      {/* 縦書きで印刷するときは、ページ全体を縦書きにする（紙ごとに右から左へ進む） */}
      {vertical ? <style>{"@media print { html { writing-mode: vertical-rl; } }"}</style> : null}

      <header className="sticky top-0 z-10 border-b bg-background/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon-sm" aria-label="章・シーンへ戻る">
              <Link href={`/creative/projects/${id}/chapters`}>
                <ChevronLeft />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-bold">📄 原稿を書き出す</h1>
              <p className="text-xs text-muted-foreground" aria-label="原稿の分量">
                {stats.chapters}章・{stats.scenes}シーン（本文あり {stats.written}）・{stats.chars.toLocaleString()}文字
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border bg-card p-0.5 text-sm" role="group" aria-label="文字の向き">
              <Link href={q({ dir: "" })} replace scroll={false} aria-current={!vertical || undefined} className={cn("rounded-full px-3 py-1", !vertical && "bg-primary text-primary-foreground")}>
                横書き
              </Link>
              <Link href={q({ dir: "v" })} replace scroll={false} aria-current={vertical || undefined} className={cn("rounded-full px-3 py-1", vertical && "bg-primary text-primary-foreground")}>
                縦書き
              </Link>
            </div>
            <Link
              href={q({ titles: sceneTitles ? "0" : "" })}
              replace
              scroll={false}
              role="switch"
              aria-checked={sceneTitles}
              className={cn("rounded-full border px-3 py-1 text-sm", sceneTitles ? "border-primary bg-primary/10 text-primary" : "bg-card")}
            >
              シーン名を入れる
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintButton />
            <Button asChild size="sm" variant="outline">
              <a href={download("docx")} download>
                <Download /> Word・Googleドキュメント
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={download("txt")} download>
                <Download /> テキスト
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            PDF は印刷画面の送信先で「PDF に保存」を選びます。Word 形式（.docx）は Google ドライブにアップロードすると Google ドキュメントとして開けます。テキストはルビ（|漢字《かんじ》）などの記法をそのまま残すので、小説投稿サイトに貼り付けられます。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">
        <article className={cn("ms-paper rounded-lg border px-6 py-8 shadow-sm sm:px-12", vertical && "ms-vertical")} aria-label="原稿">
          <h1>{ms.title}</h1>
          {ms.logline?.trim() ? <p className="ms-logline">{ms.logline.trim()}</p> : null}
          {chapters.length === 0 ? (
            <p className="ms-logline" style={{ marginTop: "2em" }}>
              まだ本文がありません。シーンの本文を書くと、ここに原稿として並びます。
            </p>
          ) : (
            chapters.map((c, ci) => (
              <section key={ci}>
                <h2>{c.title}</h2>
                {c.scenes.map((s, si) => (
                  <div key={si}>
                    {sceneTitles ? <h3>{s.title}</h3> : si > 0 ? <p className="ms-break">◇</p> : null}
                    <ManuscriptBody content={s.content} />
                  </div>
                ))}
              </section>
            ))
          )}
        </article>
      </main>
    </div>
  );
}
