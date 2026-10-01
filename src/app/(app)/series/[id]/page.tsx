import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSeriesDetail } from "@/server/services/authors";
import { PageHeader } from "@/components/layout/page-header";
import { BookCover } from "@/components/books/book-cover";
import { StatusBadge, authorNames } from "@/components/books/bits";
import { EditSeriesButton } from "@/components/authors/edit-sheets";
import { STATUS_EMOJI, type BookStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default async function SeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await getSeriesDetail(prisma, id);
  if (!d) notFound();
  const { series, volumes } = d;
  const done = series.books.filter((b) => b.status === "COMPLETED").length;
  const missing = volumes.filter((v) => !v.book).length;
  const unread = volumes.filter((v) => !v.book || (v.book.status !== "COMPLETED" && v.book.status !== "DROPPED"));
  const nextUp = unread[0];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={series.title} subtitle={`${done}巻 読了${missing ? ` ・ 未登録 ${missing}巻` : ""}`} back actions={<EditSeriesButton series={series} />} />
      {series.description ? <p className="prose-note mb-5 text-[15px] text-foreground/85">{series.description}</p> : null}
      {nextUp ? (
        <p className="mb-4 rounded-xl bg-primary/10 p-3 text-sm text-primary">
          次に読むのは {nextUp.number != null ? `${nextUp.number}巻` : `『${nextUp.book?.title}』`} です
        </p>
      ) : null}
      <ol className="space-y-2">
        {volumes.map((v, i) =>
          v.book ? (
            <li key={v.book.id}>
              <Link href={`/books/${v.book.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-2.5 pr-4 hover:bg-accent/40">
                <span className="w-10 shrink-0 text-center text-sm font-semibold tabular-nums">{v.number != null ? `${v.number}巻` : "—"}</span>
                <div className="w-10 shrink-0">
                  <BookCover src={v.book.coverImage} title={v.book.title} size="xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-medium">{v.book.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{authorNames(v.book)}</p>
                </div>
                <span className="text-lg" aria-hidden>
                  {STATUS_EMOJI[v.book.status as BookStatus]}
                </span>
                <StatusBadge status={v.book.status} className="hidden sm:inline-flex" />
              </Link>
            </li>
          ) : (
            <li key={`missing-${i}`}>
              <Link
                href={`/books/new?mode=search&q=${encodeURIComponent(`${series.title} ${v.number}`)}`}
                className={cn("flex min-h-[68px] items-center gap-3 rounded-xl border border-dashed p-2.5 pr-4 text-muted-foreground hover:bg-accent/40")}
              >
                <span className="w-10 shrink-0 text-center text-sm font-semibold tabular-nums">{v.number}巻</span>
                <span className="flex-1 text-sm">未登録</span>
                <Plus className="size-4" />
              </Link>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}
