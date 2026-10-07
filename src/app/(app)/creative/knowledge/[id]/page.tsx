import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { ckRelationsOf, getCreativeKnowledge, type CkRelationView } from "@/server/services/creative-knowledge";
import { AddCkRelationButton, RemoveCkRelationButton } from "@/components/creative-knowledge/ck-relations";
import { AddCkReferenceButton, RemoveCkReferenceButton } from "@/components/creative-knowledge/ck-references";
import { ckReferencesOf } from "@/server/services/creative-knowledge-references";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTitle, TagChip } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { CkCategoryBadge, FlowChain, ItemList } from "@/components/creative-knowledge/ck-bits";
import { CkMenu } from "@/components/creative-knowledge/ck-menu";
import { CkFavoriteButton, CkMyNote } from "@/components/creative-knowledge/ck-personal";
import { ReadMore } from "@/components/ui/read-more";
import { CreativeUsageSection } from "@/components/creative/usage-section";
import { CK_REFERENCE_ICON, CK_REFERENCE_LABEL, lines } from "@/lib/creative-knowledge";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await prisma.creativeKnowledge.findUnique({ where: { id }, select: { title: true } });
  return { title: k?.title ?? "創作知識" };
}

export default async function CreativeKnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const k = await getCreativeKnowledge(prisma, id);
  if (!k) notFound();
  const [relations, references] = await Promise.all([ckRelationsOf(prisma, k.id), ckReferencesOf(prisma, k.id)]);
  const relationGroups = [...relations.reduce((m, r) => m.set(r.label, [...(m.get(r.label) ?? []), r]), new Map<string, CkRelationView[]>()).entries()];
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
      <PageHeader title="🧠 創作知識" back="/creative/knowledge" actions={
          <>
            <CkFavoriteButton id={k.id} initial={k.isFavorite} />
            <CkMenu id={k.id} title={k.title} isSample={k.origin === "seed"} />
          </>
        } />
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

        <section aria-label="自分のメモ">
          <SectionTitle>
            📝 自分のメモ <span className="text-xs font-normal text-muted-foreground">一般的な知識とは別に保存</span>
          </SectionTitle>
          <CkMyNote id={k.id} initial={k.myNote} />
        </section>

        <section aria-label="参考にした読書">
          <SectionTitle action={<AddCkReferenceButton knowledgeId={k.id} title={k.title} />}>📚 参考にした読書</SectionTitle>
          {references.length ? (
            <ul className="space-y-2">
              {references.map((r) => (
                <li key={r.id} className="relative flex items-start gap-2 rounded-xl border bg-card p-3">
                  {r.href ? <Link href={r.href} className="absolute inset-0 rounded-xl" aria-label={r.label} /> : null}
                  <span aria-hidden className="mt-0.5">
                    {CK_REFERENCE_ICON[r.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.kind === "work" ? "本棚にない作品" : CK_REFERENCE_LABEL[r.kind]}
                      {r.sub && r.kind !== "work" ? ` ・ ${r.sub}` : ""}
                      {r.location ? ` ・ ${r.location}` : ""}
                    </p>
                    {r.comment ? <p className="prose-note mt-1.5 rounded-lg bg-muted/60 p-2 text-sm">💭 {r.comment}</p> : null}
                  </div>
                  <RemoveCkReferenceButton id={r.id} label={r.label} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              この知識の具体例になった本・フレーズ・読書メモ・感想を「読書をつなげる」から登録できます。フレーズや読書メモの画面の「創作知識として保存」からもつなげられます。
            </p>
          )}
        </section>

        <section aria-label="関連知識">
          <SectionTitle action={<AddCkRelationButton knowledgeId={k.id} title={k.title} />}>🔗 関連知識</SectionTitle>
          {relationGroups.length ? (
            <div className="space-y-4">
              {relationGroups.map(([label, list]) => (
                <div key={label}>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
                  <ul className="space-y-1.5">
                    {list.map((r) => (
                      <li key={r.id} className="relative flex items-start gap-2 rounded-xl border bg-card p-3 hover:bg-accent/30">
                        <Link href={`/creative/knowledge/${r.other.id}`} className="absolute inset-0 rounded-xl" aria-label={r.other.title} />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5 font-medium">
                            {r.other.title}
                            <CkCategoryBadge category={r.other.category} />
                          </p>
                          {r.note ? <p className="mt-0.5 text-xs text-primary">{r.note}</p> : null}
                          {r.other.summary ? <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{r.other.summary}</p> : null}
                        </div>
                        <RemoveCkRelationButton id={r.id} title={r.other.title} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              「つなげる」から、上位・下位・似ている・対になる・前提・組み合わせなどの関係で、ほかの創作知識とつなげられます。
            </p>
          )}
        </section>

        <CreativeUsageSection source={{ kind: "ck", id: k.id }} defaultTitle={k.title} />

        <p className="text-xs text-muted-foreground">
          {k.origin === "seed" ? "サンプル" : "自分で作成"} ・ 作成 {format(k.createdAt, "yyyy/M/d")} ・ 更新 {format(k.updatedAt, "yyyy/M/d")}
        </p>
      </article>
    </div>
  );
}
