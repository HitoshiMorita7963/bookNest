import Link from "next/link";
import { ChevronRight, PenLine } from "lucide-react";
import { EmptyState } from "@/components/books/bits";
import { SceneStatusBadge } from "@/components/creative/bits";
import { MoveButtons, SceneSheetButton } from "@/components/creative/project-forms";
import type { projectToc } from "@/server/services/writing";

type Toc = Awaited<ReturnType<typeof projectToc>>;

/** 「続きを書く」：最後に書いていたシーンの執筆画面へ */
export function ResumeCard({ toc }: { toc: Toc }) {
  if (!toc.resume) return null;
  const started = toc.totalChars > 0;
  return (
    <Link href={`/write/${toc.resume.id}`} className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-4 hover:bg-primary/10">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <PenLine className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{started ? "続きを書く" : "書きはじめる"}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {toc.resume.chapterTitle} ・ {toc.resume.title}
        </span>
      </span>
      <ChevronRight className="size-5 text-primary" />
    </Link>
  );
}

/**
 * 作品の目次：章ごとにシーンを並べ、シーンを押すと執筆画面が開く。
 * manage のときは章・シーンの並べ替えボタンを出す（「章・シーン」タブ）。
 */
export function ProjectToc({ projectId, toc, manage = false }: { projectId: string; toc: Toc; manage?: boolean }) {
  if (!toc.chapters.length) {
    return <EmptyState icon="📖" title="まだ章がありません" description="「第1章　出会い」のように章を作り、その中にシーンを並べて書いていきます。" />;
  }
  return (
    <ol className="space-y-3" aria-label="目次">
      {toc.chapters.map((c, ci) => (
        <li key={c.id} className="rounded-2xl border bg-card">
          <div className="flex items-center gap-2 px-3 pt-3 pb-1">
            <Link href={`/creative/projects/${projectId}/chapters/${c.id}`} className="min-w-0 flex-1 hover:underline">
              <span className="block truncate font-semibold">{c.title}</span>
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{c.chars.toLocaleString()}字</span>
            {manage ? <MoveButtons kind="chapter" id={c.id} first={ci === 0} last={ci === toc.chapters.length - 1} /> : null}
          </div>
          {c.scenes.length ? (
            <ol className="px-1.5">
              {c.scenes.map((s, si) => (
                <li key={s.id} className="flex items-center gap-1 border-b border-dashed last:border-0">
                  <Link href={`/write/${s.id}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 hover:bg-accent/50" aria-label={`${s.title}を書く（${s.chars}字）`}>
                    <span className="w-5 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{si + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{s.title}</span>
                    <SceneStatusBadge status={s.status} />
                    <span className="w-14 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{s.chars ? `${s.chars.toLocaleString()}字` : "未執筆"}</span>
                  </Link>
                  {manage ? <MoveButtons kind="scene" id={s.id} first={si === 0} last={si === c.scenes.length - 1} /> : null}
                </li>
              ))}
            </ol>
          ) : null}
          <div className="px-1.5 pb-1.5">
            <SceneSheetButton chapterId={c.id} projectId={projectId} quiet />
          </div>
        </li>
      ))}
    </ol>
  );
}
