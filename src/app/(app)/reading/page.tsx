import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ja } from "date-fns/locale";
import { prisma } from "@/lib/db";
import { listReadingBooks } from "@/server/services/reading";
import { PageHeader } from "@/components/layout/page-header";
import { BookCover } from "@/components/books/book-cover";
import { EmptyState, authorNames } from "@/components/books/bits";
import { ReadingQuickActions } from "@/components/reading/reading-actions";
import { BookRow } from "@/components/books/book-grid";
import { Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { progressPercent } from "@/lib/utils";
import { bookListInclude } from "@/server/services/books";

export const metadata = { title: "読書中" };

export default async function ReadingPage() {
  const [books, paused] = await Promise.all([
    listReadingBooks(prisma),
    prisma.book.findMany({ where: { status: "PAUSED" }, include: bookListInclude, orderBy: { updatedAt: "desc" }, take: 20 }),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="読書中" subtitle={books.length ? `${books.length}冊を読んでいます` : undefined} />
      {books.length === 0 ? (
        <EmptyState
          icon="📖"
          title="いま読んでいる本はありません"
          description="本棚から本を選んで「読み始める」を押すと、ここに表示されます。"
          action={
            <Button asChild>
              <Link href="/books?status=OWNED">積読から選ぶ</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-5">
          {books.map((b) => {
            const pct = progressPercent(b.currentPage, b.pageCount);
            const last = b.sessions[0];
            return (
              <li key={b.id} className="rounded-2xl border bg-card p-4 md:p-5">
                <div className="flex gap-4">
                  <Link href={`/books/${b.id}`} className="w-24 shrink-0 sm:w-28">
                    <BookCover src={b.coverImage} title={b.title} author={authorNames(b, 1)} size="sm" priority />
                  </Link>
                  <div className="min-w-0 flex-1 space-y-2">
                    <Link href={`/books/${b.id}`} className="block">
                      <h2 className="line-clamp-2 text-lg leading-snug font-bold">『{b.title}』</h2>
                      <p className="line-clamp-1 text-sm text-muted-foreground">{authorNames(b)}</p>
                    </Link>
                    {b.pageCount ? (
                      <>
                        <p className="text-sm tabular-nums">
                          <span className="text-2xl font-bold">{b.currentPage}</span>
                          <span className="text-muted-foreground"> / {b.pageCount}ページ</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="flex-1" />
                          <span className="text-sm font-semibold text-primary tabular-nums">{pct}%</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">ページ数を登録すると進捗が表示されます</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {last ? `最終更新：${formatDistanceToNowStrict(last.date, { locale: ja, addSuffix: true })}` : "まだ進捗の記録がありません"}
                      {b._count.quotes ? ` ・ フレーズ ${b._count.quotes}件` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <ReadingQuickActions book={{ id: b.id, title: b.title, status: b.status, currentPage: b.currentPage, pageCount: b.pageCount }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {paused.length ? (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-semibold">⏸ 中断中</h2>
          <BookRow books={paused} />
        </section>
      ) : null}
    </div>
  );
}
