import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { knowledgeFacets } from "@/server/services/knowledge";

export const metadata = { title: "知識ノートを作る" };

export default async function NewKnowledgePage({ searchParams }: { searchParams: Promise<{ bookId?: string; quoteId?: string }> }) {
  const { bookId, quoteId } = await searchParams;
  const [book, quote, facets] = await Promise.all([
    bookId ? prisma.book.findUnique({ where: { id: bookId }, select: { id: true, title: true } }) : null,
    quoteId ? prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, text: true, note: true, book: { select: { id: true, title: true } } } }) : null,
    knowledgeFacets(prisma),
  ]);
  const books = [book, quote?.book].filter((b): b is { id: string; title: string } => !!b).filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="知識ノートを作る" back />
      {quote?.note ? (
        <p className="mb-4 rounded-xl border p-3 text-sm">
          <span className="text-xs text-muted-foreground">フレーズに付けたメモ：</span>
          <br />
          {quote.note}
        </p>
      ) : null}
      <KnowledgeForm
        categories={facets.categories.map((c) => c.name)}
        initial={{ title: "", content: "", category: "", tags: "", books, quotes: quote ? [{ id: quote.id, text: quote.text }] : [] }}
      />
    </div>
  );
}
