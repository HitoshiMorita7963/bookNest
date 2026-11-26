import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getQuote } from "@/server/services/quotes";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteForm } from "@/components/quotes/quote-form";
import { QuoteKnowledgeSection } from "@/components/knowledge/quote-knowledge-section";
import { CreativeUsageSection } from "@/components/creative/usage-section";
import { quoted } from "@/lib/quote-marks";

export const metadata = { title: "フレーズを編集" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await getQuote(prisma, id);
  if (!q) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="フレーズを編集" back />
      <QuoteForm
        quoteId={q.id}
        initial={{
          text: q.text,
          pageNumber: q.pageNumber ?? "",
          note: q.note ?? "",
          tags: q.tags.map((t) => t.tag.name).join("、"),
          isFavorite: q.isFavorite,
          book: q.book ? { id: q.book.id, title: q.book.title, coverImage: q.book.coverImage } : null,
          originalImage: q.originalImage,
        }}
      />
      {/* 知識・創作への関連付けは、フォームの「更新する」を待たずにその場で保存される */}
      <div className="mt-10 space-y-8 border-t pt-6">
        <QuoteKnowledgeSection quote={q} editing />
        <CreativeUsageSection
          source={{ kind: "quote", id: q.id }}
          defaultTitle={q.text.slice(0, 30)}
          defaultContent={`${quoted(q.text)}${q.book ? `
——『${q.book.title}』${q.pageNumber ? ` ${q.pageNumber}` : ""}` : ""}`}
        />
      </div>
    </div>
  );
}
