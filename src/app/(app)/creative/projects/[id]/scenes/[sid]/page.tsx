import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getScene } from "@/server/services/novels";
import { describeSource } from "@/server/services/creative";
import { SectionTitle } from "@/components/books/bits";
import { DeleteItemButton, SceneSheetButton } from "@/components/creative/project-forms";
import { SceneStatusBadge } from "@/components/creative/bits";
import { LinkList } from "@/components/creative/note-client";
import { AddReferenceButton } from "@/components/creative/reference-picker";

export const metadata = { title: "シーン" };
const ICON = { book: "📚", quote: "💬", knowledge: "🧠", note: "💡" } as const;

export default async function ScenePage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const { id, sid } = await params;
  const s = await getScene(prisma, sid);
  if (!s || s.chapter.projectId !== id) notFound();
  const materials = s.links.map((l) => {
    const src = describeSource(l);
    return { id: l.id, icon: ICON[src.kind], label: src.label, sub: src.sub, href: src.href, purpose: l.purpose };
  });
  return (
    <div className="space-y-6">
      <Link href={`/creative/projects/${id}/chapters/${s.chapter.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> {s.chapter.title}
      </Link>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-xl font-bold">🎬 {s.title}</h2>
          <SceneStatusBadge status={s.status} />
        </div>
        <SceneSheetButton chapterId={s.chapter.id} scene={{ id: s.id, title: s.title, status: s.status, summary: s.summary ?? "", content: s.content ?? "" }} />
        <DeleteItemButton kind="scene" id={s.id} label={`シーン「${s.title}」`} redirectTo={`/creative/projects/${id}/chapters/${s.chapter.id}`} />
      </header>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">概要</h3>
        {s.summary ? <p className="prose-note rounded-xl border bg-card p-3 text-[15px]">{s.summary}</p> : <p className="text-sm text-muted-foreground">鉛筆ボタンから、このシーンで起きることを書きましょう。</p>}
      </section>
      {s.content ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">下書き（セリフ・描写）</h3>
          <div className="quote-text rounded-xl border bg-card p-4 text-[16px]">{s.content}</div>
        </section>
      ) : null}
      <section>
        <SectionTitle action={<AddReferenceButton projectId={id} fixedTarget={{ kind: "scene", id: s.id, label: s.title }} />}>📚 このシーンの参考資料</SectionTitle>
        <LinkList items={materials} empty="情景描写や会話の参考にした本・フレーズ・知識・創作メモを関連付けましょう。" />
      </section>
    </div>
  );
}
