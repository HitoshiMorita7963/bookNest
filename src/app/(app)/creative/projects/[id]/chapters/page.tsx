import Link from "next/link";
import { prisma } from "@/lib/db";
import { EmptyState, SectionTitle } from "@/components/books/bits";
import { ChapterSheetButton, MoveButtons } from "@/components/creative/project-forms";
import { SceneStatusBadge } from "@/components/creative/bits";

export const metadata = { title: "章・シーン" };

export default async function ChaptersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chapters = await prisma.chapter.findMany({
    where: { projectId: id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { scenes: { select: { id: true, title: true, status: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
  });
  return (
    <section>
      <SectionTitle action={<ChapterSheetButton projectId={id} />}>📖 章・シーン</SectionTitle>
      {chapters.length === 0 ? (
        <EmptyState icon="📖" title="まだ章がありません" description="「第1章　出会い」のように章を作り、その中にシーンを並べていきます。" />
      ) : (
        <ol className="space-y-3">
          {chapters.map((c, i) => (
            <li key={c.id} className="rounded-2xl border bg-card">
              <div className="flex items-center gap-2 p-3">
                <Link href={`/creative/projects/${id}/chapters/${c.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.title}</p>
                  {c.summary ? <p className="line-clamp-2 text-sm text-muted-foreground">{c.summary}</p> : null}
                  <p className="text-xs text-muted-foreground">シーン {c.scenes.length}</p>
                </Link>
                <MoveButtons kind="chapter" id={c.id} first={i === 0} last={i === chapters.length - 1} />
              </div>
              {c.scenes.length ? (
                <ul className="border-t px-3 py-2">
                  {c.scenes.map((s) => (
                    <li key={s.id}>
                      <Link href={`/creative/projects/${id}/scenes/${s.id}`} className="flex min-h-10 items-center gap-2 text-sm hover:underline">
                        <span aria-hidden>🎬</span>
                        <span className="min-w-0 flex-1 truncate">{s.title}</span>
                        <SceneStatusBadge status={s.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
