import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { KnowledgeForm } from "@/components/knowledge/knowledge-form";
import { getKnowledge, knowledgeFacets } from "@/server/services/knowledge";

export const metadata = { title: "知識ノートを編集" };

export default async function EditKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [k, facets] = await Promise.all([getKnowledge(prisma, id), knowledgeFacets(prisma)]);
  if (!k) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="知識ノートを編集" back />
      <KnowledgeForm
        id={k.id}
        categories={facets.categories.map((c) => c.name)}
        initial={{
          title: k.title,
          content: k.content,
          category: k.category ?? "",
          tags: k.tags.map((t) => t.tag.name).join("、"),
          books: k.books.map((b) => ({ id: b.book.id, title: b.book.title })),
          quotes: k.quotes.map((q) => ({ id: q.quote.id, text: q.quote.text })),
        }}
      />
    </div>
  );
}
