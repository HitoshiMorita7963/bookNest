import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Brain, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getQuote } from "@/server/services/quotes";
import { PageHeader } from "@/components/layout/page-header";
import { BookCover } from "@/components/books/book-cover";
import { TagChip, SectionTitle } from "@/components/books/bits";
import { DeleteQuoteButton, QuoteMenu } from "@/components/quotes/quote-menu";
import { Button } from "@/components/ui/button";
import { AiQuoteAnalysis } from "@/components/ai/ai-quote-analysis";

export const metadata = { title: "フレーズ" };

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await getQuote(prisma, id);
  if (!q) notFound();
  const page = q.pageNumber ? (/^\d+(-\d+)?$/.test(q.pageNumber) ? `p.${q.pageNumber}` : q.pageNumber) : null;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="フレーズ" back actions={<QuoteMenu id={q.id} isFavorite={q.isFavorite} text={q.text} />} />
      <article className="space-y-6">
        <blockquote className="quote-text rounded-2xl border bg-card p-5 text-lg md:p-7 md:text-xl">「{q.text}」</blockquote>
        {q.book ? (
          <Link href={`/books/${q.book.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:bg-accent/40">
            <div className="w-11 shrink-0">
              <BookCover src={q.book.coverImage} title={q.book.title} size="xs" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 font-medium">『{q.book.title}』</p>
              <p className="text-sm text-muted-foreground">
                {q.book.authors.map((a) => a.author.name).join("、")}
                {page ? ` ・ ${page}` : ""}
              </p>
            </div>
          </Link>
        ) : page ? (
          <p className="text-sm text-muted-foreground">{page}</p>
        ) : null}
        {q.tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {q.tags.map((t) => (
              <TagChip key={t.tag.id} name={t.tag.name} href={`/quotes?tag=${encodeURIComponent(t.tag.name)}`} />
            ))}
          </div>
        ) : null}
        {q.note ? (
          <section className="rounded-xl bg-muted/60 p-4">
            <p className="text-xs font-medium text-muted-foreground">📝 自分のメモ</p>
            <p className="prose-note mt-1 text-[15px]">{q.note}</p>
          </section>
        ) : null}

        <section>
          <SectionTitle
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={`/knowledge/new?quoteId=${q.id}${q.book ? `&bookId=${q.book.id}` : ""}`}>
                  <Plus /> 知識ノートを作る
                </Link>
              </Button>
            }
          >
            <Brain className="size-5 text-primary" /> このフレーズから得た知識
          </SectionTitle>
          {q.knowledge.length ? (
            <ul className="space-y-2">
              {q.knowledge.map(({ knowledge: k }) => (
                <li key={k.id}>
                  <Link href={`/knowledge/${k.id}`} className="block rounded-xl border bg-card p-3 hover:bg-accent/40">
                    <p className="font-medium">🧠 {k.title}</p>
                    {k.content ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{k.content}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">フレーズ（本の言葉）とメモ（なぜ残したか）から、自分が得た理解を「知識」として残せます。</p>
          )}
        </section>


        <AiQuoteAnalysis quoteId={q.id} quoteText={q.text} book={q.book ? { id: q.book.id, title: q.book.title } : null} />

        {q.originalImage ? (
          <details className="rounded-xl border bg-card">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-medium">元画像を表示</summary>
            <div className="p-3 pt-0">
              <img src={q.originalImage} alt="フレーズの元画像" className="w-full rounded-lg" loading="lazy" />
            </div>
          </details>
        ) : null}
        <p className="text-xs text-muted-foreground">
          保存日 {format(q.createdAt, "yyyy/M/d HH:mm")}
          {q.updatedAt.getTime() - q.createdAt.getTime() > 60000 ? ` ・ 更新 ${format(q.updatedAt, "yyyy/M/d")}` : ""}
        </p>
        <DeleteQuoteButton id={q.id} />
      </article>
    </div>
  );
}
