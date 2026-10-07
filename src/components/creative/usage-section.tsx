import Link from "next/link";
import { prisma } from "@/lib/db";
import { creativeUsageOf } from "@/server/services/creative";
import { ckUsageOfSource } from "@/server/services/creative-knowledge-references";
import { CkCategoryBadge } from "@/components/creative-knowledge/ck-bits";
import { SectionTitle } from "@/components/books/bits";
import { CategoryBadge } from "./bits";
import { UseInCreativeButton } from "./use-in-creative";
import { UnlinkCreativeButton } from "./unlink-button";
import { LINK_TARGET_LABEL, type LinkSourceKind } from "@/lib/constants";

const ICON: Record<string, string> = { project: "✍️", character: "👤", world: "🌍", plot: "📋", chapter: "📖", scene: "🎬", note: "💡" };

/** 本・フレーズ・知識・創作知識の詳細に表示する「創作への利用」（逆引き） */
export async function CreativeUsageSection({
  source,
  defaultTitle,
  defaultContent,
}: {
  source: { kind: Exclude<LinkSourceKind, "note">; id: string };
  defaultTitle?: string;
  defaultContent?: string;
}) {
  const [usage, knowledgeUsage] = await Promise.all([
    creativeUsageOf(prisma, source),
    // 創作知識そのものは「参考にした読書」の元にならない
    source.kind === "ck" ? [] : ckUsageOfSource(prisma, { kind: source.kind === "knowledge" ? "knowledgeNote" : source.kind, id: source.id }),
  ]);
  const heading =
    source.kind === "book"
      ? "この本から生まれた創作"
      : source.kind === "quote"
        ? "このフレーズを使っている創作"
        : source.kind === "ck"
          ? "この創作知識を使っている作品・創作メモ"
          : "この知識を使っている創作";
  const title = source.kind === "ck" ? "使用している作品" : "創作への利用";
  return (
    <section aria-label={title}>
      <SectionTitle action={<UseInCreativeButton source={source} defaultTitle={defaultTitle} defaultContent={defaultContent} />}>✍️ {title}</SectionTitle>
      {knowledgeUsage.length ? (
        <div className="mb-3 space-y-1.5">
          <p className="text-xs text-muted-foreground">{source.kind === "book" ? "この本（フレーズ・読書メモ・感想を含む）" : "これ"}を参考にしている創作知識</p>
          <ul className="space-y-1.5">
            {knowledgeUsage.map((k) => (
              <li key={k.id}>
                <Link href={`/creative/knowledge/${k.id}`} className="block rounded-lg border bg-card px-3 py-2 text-sm hover:bg-accent/50">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">🧠 {k.title}</span>
                    <CkCategoryBadge category={k.category} />
                  </span>
                  {k.comments[0] ? <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">💭 {k.comments[0]}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {usage.projects.length || usage.notes.length ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{heading}</p>
          {usage.projects.map((p) => (
            <div key={p.id} className="rounded-xl border bg-card p-3">
              <Link href={`/creative/projects/${p.id}`} className="font-semibold hover:underline">
                ✍️ {p.title}
              </Link>
              <ul className="mt-2 space-y-1 border-l-2 border-primary/30 pl-3 text-sm">
                {p.items.map((it, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-1.5">
                    <span aria-hidden>{ICON[it.kind]}</span>
                    <span className="text-xs text-muted-foreground">{LINK_TARGET_LABEL[it.kind]}</span>
                    <Link href={it.href} className="hover:underline">
                      {it.label}
                    </Link>
                    {it.purpose ? <span className="text-xs text-muted-foreground">（{it.purpose}）</span> : null}
                    {it.via ? <span className="text-xs text-muted-foreground">← 💡{it.via}</span> : null}
                    {it.linkId ? <UnlinkCreativeButton linkId={it.linkId} label={it.label} className="ml-auto self-center" /> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {usage.notes.length ? (
            <ul className="space-y-1.5">
              {usage.notes.map((n) => (
                <li key={n.id} className="flex items-center gap-1 rounded-lg border bg-card pr-1 hover:bg-accent/50">
                  <Link href={`/creative/notes/${n.id}`} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">💡 {n.title}</span>
                    <CategoryBadge category={n.category} />
                  </Link>
                  <UnlinkCreativeButton linkId={n.linkId} label={n.title} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : knowledgeUsage.length ? null : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          {source.kind === "ck"
            ? "「創作に使う」から、この知識を作品・人物・章・シーンに関連付けたり、創作メモを作ったりできます。"
            : "「創作に使う」から、創作メモ・創作知識を作ったり、小説の人物・シーンに関連付けたりできます。"}
        </p>
      )}
    </section>
  );
}
