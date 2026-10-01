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

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await prisma.knowledgeNote.findUnique({ where: { id }, select: { title: true } });
  return { title: k?.title ?? "知識" };
}

export default async function KnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await getKnowledge(prisma, id);
  if (!k) notFound();
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
        {k.content ? <div className="prose-note rounded-2xl border bg-card p-5 text-[16px] leading-relaxed">{k.content}</div> : null}

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

        {k.quotes.length ? (
          <section>
            <SectionTitle>💬 元になったフレーズ</SectionTitle>
            <div className="space-y-3">
              {k.quotes.map(({ quote: q }) => (
                <QuoteCard key={q.id} quote={q} />
              ))}
            </div>
          </section>
        ) : null}

        <p className="text-xs text-muted-foreground">
          作成 {format(k.createdAt, "yyyy/M/d")} ・ 更新 {format(k.updatedAt, "yyyy/M/d")}
        </p>
      </article>
    </div>
  );
}
