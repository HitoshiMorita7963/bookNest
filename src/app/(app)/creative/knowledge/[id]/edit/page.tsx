import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCreativeKnowledge } from "@/server/services/creative-knowledge";
import { PageHeader } from "@/components/layout/page-header";
import { CkForm } from "@/components/creative-knowledge/ck-form";
import { isCkCategory, type CkCategory } from "@/lib/creative-knowledge";

export const metadata = { title: "創作知識を編集" };

export default async function EditCreativeKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await getCreativeKnowledge(prisma, id);
  if (!k) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="創作知識を編集" back />
      <CkForm
        id={k.id}
        initial={{
          title: k.title,
          category: isCkCategory(k.category) ? k.category : "TROPE",
          extraCategories: k.categories.map((c) => c.category).filter(isCkCategory) as CkCategory[],
          subCategory: k.subCategory ?? "",
          summary: k.summary,
          definition: k.definition,
          effects: k.effects,
          patterns: k.patterns,
          flow: k.flow,
          usage: k.usage,
          cautions: k.cautions,
          aliases: k.aliases,
          tags: k.tags.map((t) => t.tag.name).join("、"),
        }}
      />
    </div>
  );
}
