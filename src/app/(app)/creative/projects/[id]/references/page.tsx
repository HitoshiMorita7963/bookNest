import Link from "next/link";
import { prisma } from "@/lib/db";
import { projectReferences } from "@/server/services/novels";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { ChipLink } from "@/components/ui/chip-link";
import { LinkList } from "@/components/creative/note-client";
import { AddReferenceButton } from "@/components/creative/reference-picker";
import { LINK_SOURCE_KINDS, LINK_SOURCE_LABEL, LINK_TARGET_LABEL, type LinkSourceKind } from "@/lib/constants";

export const metadata = { title: "参考資料" };
const ICON = { book: "📚", quote: "💬", knowledge: "🧠", note: "💡" } as const;

export default async function ReferencesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const { id } = await params;
  const { type } = await searchParams;
  const kind = (LINK_SOURCE_KINDS as readonly string[]).includes(type ?? "") ? (type as LinkSourceKind) : undefined;
  const refs = await projectReferences(prisma, id);
  const items = refs.items
    .filter((i) => !kind || i.source.kind === kind)
    .map((i) => ({
      id: i.id,
      icon: ICON[i.source.kind],
      label: i.source.label,
      sub: [i.source.sub, i.target.kind === "project" ? "作品全体" : `${LINK_TARGET_LABEL[i.target.kind]}：${i.target.label}`].filter(Boolean).join(" ・ "),
      href: i.source.href,
      purpose: i.purpose,
    }));
  const via = refs.viaNotes.filter((v) => !kind || v.source.kind === kind);
  const base = `/creative/projects/${id}/references`;
  return (
    <section className="space-y-4">
      <SectionTitle action={<AddReferenceButton projectId={id} />}>📚 参考資料</SectionTitle>
      <p className="text-sm text-muted-foreground">この作品に影響を与えた本・フレーズ・知識・創作メモと、何のための資料かを記録します。</p>
      <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="資料の種類">
        <ChipLink href={base} active={!kind}>
          すべて {refs.items.length}
        </ChipLink>
        {LINK_SOURCE_KINDS.map((k) => (
          <ChipLink key={k} href={`${base}?type=${k}`} active={kind === k}>
            {ICON[k]} {LINK_SOURCE_LABEL[k]} {refs.counts[k]}
          </ChipLink>
        ))}
      </nav>
      {items.length === 0 && via.length === 0 ? (
        <EmptyState icon="📚" title="まだ参考資料がありません" description="「資料を追加」や、本・フレーズ・知識の画面の「創作に使う」から関連付けられます。" />
      ) : (
        <>
          <LinkList items={items} />
          {via.length ? (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-semibold text-muted-foreground">創作メモを通じて影響した資料</h3>
              <ul className="space-y-1.5">
                {via.map((v) => (
                  <li key={v.id}>
                    <Link href={v.source.href} className="block rounded-xl border bg-card px-3 py-2.5 text-sm hover:bg-accent/40">
                      {ICON[v.source.kind]} {v.source.label}
                      <span className="block text-xs text-muted-foreground">💡 {v.via} 経由</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
