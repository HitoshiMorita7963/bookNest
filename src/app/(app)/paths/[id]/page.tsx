import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPath } from "@/server/services/paths";
import { PageHeader } from "@/components/layout/page-header";
import { BookCover } from "@/components/books/book-cover";
import { EmptyState, StatusBadge, authorNames } from "@/components/books/bits";
import { Progress } from "@/components/ui/primitives";
import { PathItemControls, PathMenu } from "@/components/paths/path-client";
import { cn, progressPercent } from "@/lib/utils";

export default async function PathPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getPath(prisma, id);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={p.title} subtitle={`${p.done} / ${p.books.length}冊 読了`} back="/paths" actions={<PathMenu path={p} bookIds={p.books.map((b) => b.bookId)} />} />
      {p.description ? <p className="prose-note mb-4 text-[15px] text-foreground/85">{p.description}</p> : null}
      <Progress value={progressPercent(p.done, p.books.length)} className="mb-6 h-3" label="ルートの進捗" />
      {p.books.length === 0 ? (
        <EmptyState icon="📚" title="まだ本がありません" description="右上の「本を追加」から、読む順番に本を追加してください。" />
      ) : (
        <ol className="relative space-y-3 before:absolute before:top-4 before:bottom-4 before:left-[19px] before:w-0.5 before:bg-border">
          {p.books.map((pb, i) => {
            const done = pb.book.status === "COMPLETED";
            const isNext = i === p.nextIdx;
            return (
              <li key={pb.bookId} className="relative flex items-center gap-3">
                <span
                  className={cn(
                    "z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                    done ? "border-primary bg-primary text-primary-foreground" : isNext ? "border-primary bg-background text-primary" : "bg-background text-muted-foreground",
                  )}
                  aria-label={done ? `${i + 1}（読了）` : `${i + 1}`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <div className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-card p-2.5", isNext && "border-primary ring-1 ring-primary")}>
                  <Link href={`/books/${pb.book.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="w-10 shrink-0">
                      <BookCover src={pb.book.coverImage} title={pb.book.title} size="xs" />
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-1 font-medium">{pb.book.title}</p>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{authorNames(pb.book)}</p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <StatusBadge status={pb.book.status} />
                        {isNext ? <span className="text-xs font-semibold text-primary">次に読む</span> : null}
                      </div>
                    </div>
                  </Link>
                  <PathItemControls pathId={p.id} bookId={pb.bookId} first={i === 0} last={i === p.books.length - 1} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
