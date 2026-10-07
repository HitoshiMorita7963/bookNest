import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { searchAll, snippet } from "@/server/services/search";
import { searchCreativeKnowledge } from "@/server/services/creative-knowledge-search";
import { CkCard } from "@/components/creative-knowledge/ck-bits";
import { PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/search/search-box";
import { BookList } from "@/components/books/book-grid";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { QuoteCard } from "@/components/quotes/quote-card";

export const metadata = { title: "検索" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.slice(0, 100);
  const [r, ckHits] = query.trim() ? await Promise.all([searchAll(prisma, query), searchCreativeKnowledge(prisma, query, { take: 6, withRelated: false })]) : [null, []];
  const total = r ? r.bookCount + r.records.length + r.quoteCount + r.knowledgeCount + r.notes.length + r.authors.length + r.creativeNotes.length + r.projects.length + ckHits.length : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="検索" />
      <SearchBox initial={query} />
      {!r ? (
        <div className="mt-6 rounded-xl bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
          本のタイトル・著者・ISBN・出版社・タグに加えて、感想・要約・学んだこと・読書メモ・保存したフレーズ・知識ノート・創作知識・創作メモ・小説プロジェクトをまとめて検索できます。
        </div>
      ) : total === 0 ? (
        <EmptyState className="mt-6" icon="🔍" title={`「${query}」に一致するものはありませんでした`} description="別のキーワードや、短い単語で検索してみてください。" />
      ) : (
        <div className="mt-6 space-y-8">
          {ckHits.length ? (
            <section>
              <SectionTitle action={<Link href={`/creative/knowledge?q=${encodeURIComponent(query)}`} className="text-sm text-primary">創作知識で探す</Link>}>🧠 創作知識</SectionTitle>
              <ul className="grid gap-3 md:grid-cols-2">
                {ckHits.map((h) => (
                  <CkCard key={h.item.id} k={h.item} note={h.reason} />
                ))}
              </ul>
            </section>
          ) : null}
          {r.authors.length ? (
            <section>
              <SectionTitle>👤 著者</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {r.authors.map((a) => (
                  <Link key={a.id} href={`/authors/${a.id}`} className="inline-flex h-10 items-center gap-2 rounded-full border bg-card px-4 text-sm hover:bg-accent">
                    {a.name}
                    <span className="text-xs text-muted-foreground">{a._count.books}冊</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {r.books.length ? (
            <section>
              <SectionTitle action={r.bookCount > r.books.length ? <Link href={`/books?q=${encodeURIComponent(query)}`} className="text-sm text-primary">すべて見る</Link> : null}>
                📚 本 <span className="text-sm font-normal text-muted-foreground">{r.bookCount}件</span>
              </SectionTitle>
              <BookList books={r.books} />
            </section>
          ) : null}
          {r.quotes.length ? (
            <section>
              <SectionTitle action={r.quoteCount > r.quotes.length ? <Link href={`/quotes?q=${encodeURIComponent(query)}`} className="text-sm text-primary">すべて見る</Link> : null}>
                💬 フレーズ <span className="text-sm font-normal text-muted-foreground">{r.quoteCount}件</span>
              </SectionTitle>
              <div className="space-y-3">
                {r.quotes.map((qt) => (
                  <QuoteCard key={qt.id} quote={qt} highlight={r.terms[0]} />
                ))}
              </div>
            </section>
          ) : null}
          {r.knowledge.length ? (
            <section>
              <SectionTitle>🧠 知識 <span className="text-sm font-normal text-muted-foreground">{r.knowledgeCount}件</span></SectionTitle>
              <ul className="space-y-2">
                {r.knowledge.map((k) => (
                  <li key={k.id}>
                    <Link href={`/knowledge/${k.id}`} className="block rounded-xl border bg-card p-3 hover:bg-accent/50">
                      <p className="font-medium">{k.title}</p>
                      {k.content ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{snippet(k.content, r.terms)}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {r.projects.length || r.creativeNotes.length ? (
            <section>
              <SectionTitle>✍️ 創作</SectionTitle>
              <ul className="space-y-2">
                {r.projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/creative/projects/${p.id}`} className="block rounded-xl border bg-card p-3 hover:bg-accent/50">
                      <p className="font-medium">✍️ {p.title}</p>
                      {p.logline ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.logline}</p> : null}
                    </Link>
                  </li>
                ))}
                {r.creativeNotes.map((n) => (
                  <li key={n.id}>
                    <Link href={`/creative/notes/${n.id}`} className="block rounded-xl border bg-card p-3 hover:bg-accent/50">
                      <p className="font-medium">💡 {n.title}</p>
                      {n.content ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{snippet(n.content, r.terms)}</p> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {r.records.length ? (
            <section>
              <SectionTitle>📝 感想・学んだこと</SectionTitle>
              <ul className="space-y-2">
                {r.records.map((rec) => {
                  const text = [rec.review, rec.summary, rec.learned, rec.memorable, rec.questions].filter(Boolean).join("\n");
                  return (
                    <li key={rec.id}>
                      <Link href={`/books/${rec.book.id}`} className="block rounded-xl border bg-card p-3 hover:bg-accent/50">
                        <p className="text-sm font-medium">『{rec.book.title}』</p>
                        <p className="mt-1 text-sm text-muted-foreground">{snippet(text, r.terms)}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          {r.notes.length ? (
            <section>
              <SectionTitle>🗒 読書メモ</SectionTitle>
              <ul className="space-y-2">
                {r.notes.map((n) => (
                  <li key={n.id}>
                    <Link href={`/books/${n.book.id}`} className="block rounded-xl border bg-card p-3 hover:bg-accent/50">
                      <p className="text-xs text-muted-foreground">
                        {format(n.date, "yyyy/M/d")} ・ 『{n.book.title}』
                      </p>
                      <p className="mt-1 text-sm">{snippet(n.note ?? "", r.terms)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
