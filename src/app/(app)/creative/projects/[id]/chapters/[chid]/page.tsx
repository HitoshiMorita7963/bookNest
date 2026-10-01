import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getChapter } from "@/server/services/novels";
import { describeSource } from "@/server/services/creative";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { ChapterSheetButton, DeleteItemButton, MoveButtons, SceneSheetButton } from "@/components/creative/project-forms";
import { SceneStatusBadge } from "@/components/creative/bits";
import { LinkList } from "@/components/creative/note-client";
import { AddReferenceButton } from "@/components/creative/reference-picker";

const ICON = { book: "📚", quote: "💬", knowledge: "🧠", note: "💡" } as const;

export default async function ChapterPage({ params }: { params: Promise<{ id: string; chid: string }> }) {
  const { id, chid } = await params;
  const c = await getChapter(prisma, chid);
  if (!c || c.projectId !== id) notFound();
  const materials = c.links.map((l) => {
    const s = describeSource(l);
    return { id: l.id, icon: ICON[s.kind], label: s.label, sub: s.sub, href: s.href, purpose: l.purpose };
  });
  return (
    <div className="space-y-6">
      <Link href={`/creative/projects/${id}/chapters`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> 章の一覧
      </Link>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold">📖 {c.title}</h2>
          {c.summary ? <p className="prose-note mt-1 text-[15px] text-foreground/85">{c.summary}</p> : null}
        </div>
        <ChapterSheetButton projectId={id} chapter={{ id: c.id, title: c.title, summary: c.summary ?? "" }} />
        <DeleteItemButton kind="chapter" id={c.id} label={`章「${c.title}」`} redirectTo={`/creative/projects/${id}/chapters`} />
      </header>
      <section>
        <SectionTitle action={<SceneSheetButton chapterId={c.id} projectId={id} />}>🎬 シーン</SectionTitle>
        {c.scenes.length === 0 ? (
          <EmptyState icon="🎬" title="まだシーンがありません" description="この章の場面を、順番に追加していきましょう。" />
        ) : (
          <ol className="space-y-2">
            {c.scenes.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 rounded-2xl border bg-card p-2 pl-3">
                <span className="w-6 shrink-0 text-center text-sm font-bold text-primary tabular-nums">{i + 1}</span>
                <Link href={`/creative/projects/${id}/scenes/${s.id}`} className="min-w-0 flex-1 py-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{s.title}</p>
                    <SceneStatusBadge status={s.status} />
                  </div>
                  {s.summary ? <p className="line-clamp-2 text-sm text-muted-foreground">{s.summary}</p> : null}
                  {s._count.links ? <p className="text-xs text-muted-foreground">📚 参考資料 {s._count.links}</p> : null}
                </Link>
                <MoveButtons kind="scene" id={s.id} first={i === 0} last={i === c.scenes.length - 1} />
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <SectionTitle action={<AddReferenceButton projectId={id} fixedTarget={{ kind: "chapter", id: c.id, label: c.title }} />}>📚 この章の参考資料</SectionTitle>
        <LinkList items={materials} empty="この章で参考にする本・フレーズ・知識・創作メモを関連付けましょう。" />
      </section>
    </div>
  );
}
