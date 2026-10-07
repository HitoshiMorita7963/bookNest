import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCreativeKnowledge } from "@/server/services/creative-knowledge";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTitle, TagChip } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { CkCategoryBadge, FlowChain, ItemList } from "@/components/creative-knowledge/ck-bits";
import { CkMenu } from "@/components/creative-knowledge/ck-menu";
import { ReadMore } from "@/components/ui/read-more";
import { lines } from "@/lib/creative-knowledge";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await prisma.creativeKnowledge.findUnique({ where: { id }, select: { title: true } });
  return { title: k?.title ?? "創作知識" };
}

export default async function CreativeKnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await getCreativeKnowledge(prisma, id);
  if (!k) notFound();
  const aliases = lines(k.aliases);
  const sections: { title: string; node: React.ReactNode }[] = [];
  if (k.definition) sections.push({ title: "📖 定義・説明", node: <ReadMore className="prose-note text-[15px] leading-relaxed">{k.definition}</ReadMore> });
  if (lines(k.effects).length) sections.push({ title: "✨ 物語上の効果", node: <ItemList text={k.effects} /> });
  if (lines(k.patterns).length) sections.push({ title: "🧩 主なパターン", node: <ItemList text={k.patterns} /> });
  if (lines(k.flow).length) sections.push({ title: "🌊 感情・展開の流れ", node: <FlowChain text={k.flow} /> });
  if (lines(k.usage).length) sections.push({ title: "🛠 使い方", node: <ItemList text={k.usage} /> });
  if (lines(k.cautions).length) sections.push({ title: "⚠️ 注意点", node: <ItemList text={k.cautions} /> });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="🧠 創作知識" back="/creative/knowledge" actions={<CkMenu id={k.id} title={k.title} />} />
      <article className="space-y-7">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <CkCategoryBadge category={k.category} link />
            {k.subCategory ? <span className="text-sm text-muted-foreground">{k.subCategory}</span> : null}
            {k.categories.map((c) => (
              <CkCategoryBadge key={c.category} category={c.category} link className="bg-secondary text-secondary-foreground" />
            ))}
          </div>
          <h2 className="text-2xl font-bold">{k.title}</h2>
          {k.summary ? <p className="prose-note text-[16px] leading-relaxed">{k.summary}</p> : null}
          {k.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {k.tags.map((t) => (
                <TagChip key={t.tag.id} name={t.tag.name} href={`/creative/knowledge?tag=${encodeURIComponent(t.tag.name)}`} />
              ))}
            </div>
          ) : null}
          {aliases.length ? <p className="text-xs text-muted-foreground">別名：{aliases.join("、")}</p> : null}
        </header>

        {sections.length ? (
          sections.map((s) => (
            <section key={s.title}>
              <SectionTitle>{s.title}</SectionTitle>
              {s.node}
            </section>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            <p>定義・効果・パターン・注意点などはまだ書かれていません。</p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/creative/knowledge/${k.id}/edit`}>
                <Pencil /> 説明を書く
              </Link>
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {k.origin === "seed" ? "サンプル" : "自分で作成"} ・ 作成 {format(k.createdAt, "yyyy/M/d")} ・ 更新 {format(k.updatedAt, "yyyy/M/d")}
        </p>
      </article>
    </div>
  );
}
