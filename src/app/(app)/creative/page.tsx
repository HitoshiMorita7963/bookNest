import Link from "next/link";
import { ChevronRight, Lightbulb, PenSquare, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { listProjects } from "@/server/services/novels";
import { listCreativeNotes } from "@/server/services/creative";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { Button } from "@/components/ui/button";
import { ProjectStatusBadge } from "@/components/creative/bits";
import { CreativeNoteCard } from "@/components/creative/note-card";

export const metadata = { title: "創作" };

export default async function CreativeHomePage() {
  const [projects, notes] = await Promise.all([listProjects(prisma), listCreativeNotes(prisma, { take: 5 })]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="✍️ 創作" subtitle="読書で得たものを、作品へ" />
      <div className="space-y-8">
        <div className="grid grid-cols-2 gap-3">
          <Link href="/creative/notes/new" className="flex min-h-20 flex-col justify-center gap-1 rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm active:scale-[0.99]">
            <Lightbulb className="size-6" />
            <span className="font-semibold">創作メモ</span>
          </Link>
          <Link href="/creative/projects/new" className="flex min-h-20 flex-col justify-center gap-1 rounded-2xl border bg-card p-4 hover:bg-accent/40 active:scale-[0.99]">
            <PenSquare className="size-6 text-primary" />
            <span className="font-semibold">新しい小説</span>
          </Link>
        </div>

        <section>
          <SectionTitle>📚 小説プロジェクト</SectionTitle>
          {projects.length === 0 ? (
            <EmptyState
              icon="✍️"
              title="まだ小説プロジェクトがありません。"
              description={
                <>
                  読書中に思いついたアイデアを、
                  <br />
                  小説としてまとめてみましょう。
                </>
              }
              action={
                <Button asChild size="lg">
                  <Link href="/creative/projects/new">
                    <Plus /> 新しい小説を作る
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/creative/projects/${p.id}`} className="block rounded-2xl border bg-card p-4 hover:bg-accent/40">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">✍️ {p.title}</p>
                      <ProjectStatusBadge status={p.status} />
                    </div>
                    {p.logline ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.logline}</p> : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      👤 {p._count.characters} ・ 🌍 {p._count.worldSettings} ・ 📋 {p._count.plots} ・ 📖 {p._count.chapters} ・ 📚 資料 {p._count.links}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle action={<Link href="/creative/notes" className="text-sm text-primary">すべて</Link>}>💡 最近の創作メモ</SectionTitle>
          {notes.items.length === 0 ? (
            <EmptyState
              icon="💡"
              title="まだ創作メモがありません。"
              description={
                <>
                  本を読んでいて思いついたことを
                  <br />
                  ここに残しておきましょう。
                </>
              }
              action={
                <Button asChild>
                  <Link href="/creative/notes/new">
                    <Plus /> 創作メモ
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {notes.items.map((n) => (
                <CreativeNoteCard key={n.id} note={n} />
              ))}
            </div>
          )}
        </section>

        <Link href="/search" className="flex items-center justify-between rounded-2xl border border-dashed p-4 text-sm text-muted-foreground hover:bg-accent/40">
          本・フレーズ・知識から創作に使えるものを探す
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
