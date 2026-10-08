import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getKnowledge } from "@/server/services/knowledge";
import { PageHeader } from "@/components/layout/page-header";
import { BookCover } from "@/components/books/book-cover";
import { SectionTitle, TagChip, authorNames } from "@/components/books/bits";
import { QuoteCard } from "@/components/quotes/quote-card";
import { KnowledgeMenu, UnlinkKnowledgeButton } from "@/components/knowledge/knowledge-client";
import { CreativeUsageSection } from "@/components/creative/usage-section";
import { ReadMore } from "@/components/ui/read-more";
import { LinkQuoteToKnowledgeButton, UnlinkQuoteKnowledgeButton } from "@/components/knowledge/quote-knowledge-links";
import { UnlinkNewsButton } from "@/components/news/news-client";
import { listSavedNews } from "@/server/services/news";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await prisma.knowledgeNote.findUnique({ where: { id }, select: { title: true } });
  return { title: k?.title ?? "知識" };
}

export default async function KnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await getKnowledge(prisma, id);
  if (!k) notFound();
  const news = await listSavedNews(prisma, { knowledgeId: k.id, take: 30 });
  const links = [
    ...k.linksFrom.map((l) => ({ dir: "to" as const, note: l.to, label: l.label })),
    ...k.linksTo.map((l) => ({ dir: "from" as const, note: l.from, label: l.label })),
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={k.title} back actions={<KnowledgeMenu id={k.id} title={k.title} />} />
      <article className="space-y-8">
        <header className="space-y-2">
          {k.category ? (
            <Link href={`/knowledge?category=${encodeURIComponent(k.category)}`} className="inline-block rounded-full bg-secondary px-3 py-1 text-xs">
              {k.category}
            </Link>
          ) : null}
          <h2 className="text-2xl font-bold">🧠 {k.title}</h2>
          {k.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {k.tags.map((t) => (
                <TagChip key={t.tagId} name={t.tag.name} href={`/knowledge?tag=${encodeURIComponent(t.tag.name)}`} />
              ))}
            </div>
          ) : null}
        </header>
        {k.content ? (
          <div className="rounded-2xl border bg-card p-5">
            <ReadMore className="prose-note text-[16px] leading-relaxed">{k.content}</ReadMore>
          </div>
        ) : null}

        <section>
          <SectionTitle>📚 関連書籍</SectionTitle>
          {k.books.length ? (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {k.books.map(({ book: b }) => (
                <li key={b.id}>
                  <Link href={`/books/${b.id}`}>
                    <BookCover src={b.coverImage} title={b.title} size="sm" author={authorNames(b, 1)} />
                    <p className="mt-1 line-clamp-2 text-xs font-medium">『{b.title}』</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">関連する本はまだありません。編集から追加できます。</p>
          )}
        </section>

        <section>
          <SectionTitle action={<LinkQuoteToKnowledgeButton knowledgeId={k.id} linkedIds={k.quotes.map((x) => x.quote.id)} />}>💬 元になったフレーズ</SectionTitle>
          {k.quotes.length ? (
            <div className="space-y-3">
              {k.quotes.map(({ quote: q }) => (
                <div key={q.id}>
                  <QuoteCard quote={q} hideKnowledgeId={k.id} />
                  <div className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                    このフレーズとの関連付けを解除
                    <UnlinkQuoteKnowledgeButton quoteId={q.id} knowledgeId={k.id} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">「フレーズを追加」から、この知識のきっかけになったフレーズを関連付けられます。</p>
          )}
        </section>

        {news.length ? (
          <section aria-label="関連ニュース">
            <SectionTitle>📰 関連ニュース</SectionTitle>
            <ul className="space-y-2">
              {news.map((n) => (
                <li key={n.id} className="flex items-start gap-1 rounded-xl border bg-card py-1 pr-1 pl-3">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 py-1.5">
                    <p className="line-clamp-2 text-sm font-medium hover:underline">{n.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[n.source, n.savedAt ? `${format(n.savedAt, "yyyy/M/d")} に保存` : null].filter(Boolean).join("・")}
                    </p>
                    {n.memo ? <p className="mt-0.5 text-xs text-muted-foreground">📝 {n.memo}</p> : null}
                  </a>
                  <UnlinkNewsButton newsId={n.id} knowledgeId={k.id} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <SectionTitle>🔗 つながる知識</SectionTitle>
          {links.length ? (
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={l.note.id} className="flex items-center gap-2 rounded-xl border bg-card p-2 pl-3">
                  {l.dir === "to" ? <ArrowRight className="size-4 shrink-0 text-primary" aria-label="この知識から" /> : <ArrowLeft className="size-4 shrink-0 text-primary" aria-label="この知識へ" />}
                  <Link href={`/knowledge/${l.note.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium">{l.note.title}</p>
                    {l.label ? <p className="text-xs text-muted-foreground">{l.label}</p> : null}
                  </Link>
                  <UnlinkKnowledgeButton a={k.id} b={l.note.id} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">右上のメニュー「他の知識とつなげる」から関連付けると、知識マップに表示されます。</p>
          )}
        </section>


        <CreativeUsageSection source={{ kind: "knowledge", id: k.id }} defaultTitle={k.title} defaultContent={k.content} />

        <p className="text-xs text-muted-foreground">
          作成 {format(k.createdAt, "yyyy/M/d")} ・ 更新 {format(k.updatedAt, "yyyy/M/d")}
        </p>
      </article>
    </div>
  );
}
