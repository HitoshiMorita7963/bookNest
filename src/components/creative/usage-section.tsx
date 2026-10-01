import Link from "next/link";
import { prisma } from "@/lib/db";
import { creativeUsageOf } from "@/server/services/creative";
import { SectionTitle } from "@/components/books/bits";
import { CategoryBadge } from "./bits";
import { UseInCreativeButton } from "./use-in-creative";
import { LINK_TARGET_LABEL, type LinkSourceKind } from "@/lib/constants";

const ICON: Record<string, string> = { project: "✍️", character: "👤", world: "🌍", plot: "📋", chapter: "📖", scene: "🎬", note: "💡" };

/** 本・フレーズ・知識の詳細に表示する「創作への利用」（逆引き） */
export async function CreativeUsageSection({
  source,
  defaultTitle,
  defaultContent,
}: {
  source: { kind: Exclude<LinkSourceKind, "note">; id: string };
  defaultTitle?: string;
  defaultContent?: string;
}) {
  const usage = await creativeUsageOf(prisma, source);
  const heading = source.kind === "book" ? "この本から生まれた創作" : source.kind === "quote" ? "このフレーズを使っている創作" : "この知識を使っている創作";
  return (
    <section aria-label="創作への利用">
      <SectionTitle action={<UseInCreativeButton source={source} defaultTitle={defaultTitle} defaultContent={defaultContent} />}>✍️ 創作への利用</SectionTitle>
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
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {usage.notes.length ? (
            <ul className="space-y-1.5">
              {usage.notes.map((n) => (
                <li key={n.id}>
                  <Link href={`/creative/notes/${n.id}`} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-accent/50">
                    <span className="min-w-0 flex-1 truncate">💡 {n.title}</span>
                    <CategoryBadge category={n.category} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">「創作に使う」から、創作メモを作ったり小説の人物・シーンに関連付けたりできます。</p>
      )}
    </section>
  );
}
