import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { describeSource, describeTarget, findSimilarNotes, getCreativeNote } from "@/server/services/creative";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTitle, TagChip } from "@/components/books/bits";
import { CategoryBadge, NoteStatusBadge } from "@/components/creative/bits";
import { AddToProjectButton, LinkList, NoteMenu, NoteStatusSwitcher } from "@/components/creative/note-client";
import { LINK_TARGET_LABEL } from "@/lib/constants";
import { ReadMore } from "@/components/ui/read-more";

export const metadata = { title: "創作メモ" };

const SOURCE_ICON = { book: "📚", quote: "💬", knowledge: "🧠", note: "💡" } as const;
const TARGET_ICON = { project: "✍️", character: "👤", world: "🌍", plot: "📋", chapter: "📖", scene: "🎬", note: "💡" } as const;

export default async function CreativeNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = await getCreativeNote(prisma, id);
  if (!n) notFound();
  const similar = await findSimilarNotes(prisma, `${n.title} ${n.content}`, { excludeId: n.id });
  const materials = n.materials.map((l) => {
    const s = describeSource(l);
    return { id: l.id, icon: SOURCE_ICON[s.kind], label: s.label, sub: s.sub, href: s.href, purpose: l.purpose };
  });
  const usedIn = n.usedIn.map((l) => {
    const t = describeTarget(l);
    return {
      id: l.id,
      icon: TARGET_ICON[t.kind],
      label: t.kind === "project" ? `『${t.label}』` : t.label,
      sub: t.kind === "project" ? "作品全体" : `${LINK_TARGET_LABEL[t.kind]}${t.projectTitle ? ` ・ 『${t.projectTitle}』` : ""}`,
      href: t.href,
      purpose: l.purpose,
    };
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="💡 創作メモ" back actions={<NoteMenu id={n.id} title={n.title} />} />
      <article className="space-y-6">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={n.category} />
            <NoteStatusBadge status={n.status} />
          </div>
          <h2 className="text-xl font-bold">{n.title}</h2>
          {n.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {n.tags.map((t) => (
                <TagChip key={t.tagId} name={t.tag.name} href={`/creative/notes?q=${encodeURIComponent(t.tag.name)}`} />
              ))}
            </div>
          ) : null}
        </header>
        {n.content ? (
          <div className="rounded-2xl border bg-card p-4">
            <ReadMore className="prose-note text-[16px] leading-relaxed">{n.content}</ReadMore>
          </div>
        ) : null}

        <NoteStatusSwitcher id={n.id} status={n.status} />

        <section>
          <SectionTitle action={<AddToProjectButton source={{ kind: "note", id: n.id }} />}>✍️ このメモを使っている作品</SectionTitle>
          <LinkList items={usedIn} empty="「作品に追加」から、作品・人物・世界観・プロット・章・シーンに関連付けられます。" />
        </section>

        <section>
          <SectionTitle>📚 元になった読書資料</SectionTitle>
          <LinkList items={materials} empty="本・フレーズ・知識の画面の「創作に使う」から、このメモに資料を関連付けられます。" />
        </section>

        {similar.length ? (
          <section>
            <SectionTitle>🔁 似ている創作メモ</SectionTitle>
            <ul className="space-y-1.5">
              {similar.map((s) => (
                <li key={s.id}>
                  <Link href={`/creative/notes/${s.id}`} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm hover:bg-accent/50">
                    <span className="min-w-0 flex-1 truncate">💡 {s.title}</span>
                    <CategoryBadge category={s.category} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-xs text-muted-foreground">
          作成 {format(n.createdAt, "yyyy/M/d HH:mm")} ・ 更新 {format(n.updatedAt, "yyyy/M/d HH:mm")}
        </p>
      </article>
    </div>
  );
}
