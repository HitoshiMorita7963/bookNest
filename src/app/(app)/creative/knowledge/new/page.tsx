import { PageHeader } from "@/components/layout/page-header";
import { CkForm } from "@/components/creative-knowledge/ck-form";
import { isCkCategory } from "@/lib/creative-knowledge";

export const metadata = { title: "創作知識を追加" };

export default async function NewCreativeKnowledgePage({ searchParams }: { searchParams: Promise<{ category?: string; title?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="🧠 創作知識を追加" back />
      <CkForm initial={{ ...(isCkCategory(sp.category) ? { category: sp.category } : {}), title: sp.title?.slice(0, 120) ?? "" }} />
    </div>
  );
}
