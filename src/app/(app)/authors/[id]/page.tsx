import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthorDetail } from "@/server/services/authors";
import { PageHeader } from "@/components/layout/page-header";
import { BookGrid } from "@/components/books/book-grid";
import { SectionTitle } from "@/components/books/bits";
import { StatTile } from "@/components/stats/period-tabs";
import { QuoteCard } from "@/components/quotes/quote-card";
import { EditAuthorButton } from "@/components/authors/edit-sheets";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await prisma.author.findUnique({ where: { id }, select: { name: true } });
  return { title: a?.name ?? "著者" };
}

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getAuthorDetail(prisma, id);
  if (!d) notFound();
  const groups = [
    { label: "✅ 読了作品", books: d.books.filter((b) => b.status === "COMPLETED") },
    { label: "📖 読書中", books: d.books.filter((b) => b.status === "READING" || b.status === "PAUSED") },
    { label: "📕 積読作品", books: d.books.filter((b) => b.status === "OWNED") },
    { label: "🔖 読みたい作品", books: d.books.filter((b) => b.status === "WANT_TO_READ") },
    { label: "🚫 読了断念", books: d.books.filter((b) => b.status === "DROPPED") },
  ].filter((g) => g.books.length);

  return (
    <div>
      <PageHeader title={d.author.name} back actions={<EditAuthorButton author={d.author} />} />
      <div className="space-y-8">
        {d.author.profile ? <p className="prose-note text-[15px] leading-relaxed text-foreground/85">{d.author.profile}</p> : null}
        <div className="grid grid-cols-3 gap-3 sm:max-w-lg">
          <StatTile label="読了冊数" value={String(d.completedCount)} unit="冊" />
          <StatTile label="平均評価" value={d.avgRating ? d.avgRating.toFixed(1) : "—"} unit={d.avgRating ? "★" : undefined} />
          <StatTile label="フレーズ" value={String(d.quoteCount)} unit="件" />
        </div>
        {groups.map((g) => (
          <section key={g.label}>
            <SectionTitle>
              {g.label} <span className="text-sm font-normal text-muted-foreground">{g.books.length}冊</span>
            </SectionTitle>
            <BookGrid books={g.books} />
          </section>
        ))}
        <section>
          <SectionTitle action={d.quoteCount > d.quotes.length ? <Link href={`/quotes?authorId=${d.author.id}`} className="text-sm text-primary">すべて見る</Link> : null}>
            💬 保存したフレーズ <span className="text-sm font-normal text-muted-foreground">{d.quoteCount}件</span>
          </SectionTitle>
          {d.quotes.length ? (
            <div className="space-y-3">
              {d.quotes.map((q) => (
                <QuoteCard key={q.id} quote={q} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">この著者の本から保存したフレーズはまだありません。</p>
          )}
        </section>
      </div>
    </div>
  );
}
