import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus, Search } from "lucide-react";
import { prisma } from "@/lib/db";
import { BookCover } from "@/components/books/book-cover";
import { BookRow } from "@/components/books/book-grid";
import { EmptyState, SectionTitle, authorNames } from "@/components/books/bits";
import { ReadingQuickActions } from "@/components/reading/reading-actions";
import { Progress } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { QuoteCard } from "@/components/quotes/quote-card";
import { BookNestLogo } from "@/components/layout/logo";
import { listReadingBooks } from "@/server/services/reading";
import { getSummary } from "@/server/services/stats";
import { getYearlyBookGoal } from "@/server/services/goals";
import { recommendNext } from "@/server/services/recommend";
import { bookListInclude } from "@/server/services/books";
import { formatNumber, progressPercent } from "@/lib/utils";
import { TodayNewsSection, TodayNewsSkeleton } from "@/components/news/news-list";

export const dynamic = "force-dynamic";

function greeting(h: number) {
  if (h < 5) return "こんばんは";
  if (h < 11) return "おはようございます";
  if (h < 18) return "こんにちは";
  return "こんばんは";
}

export default async function HomePage() {
  const now = new Date();
  const [user, reading, month, goal, quotes, completed, tsundoku, tsundokuCount, recs, total] = await Promise.all([
    prisma.user.findUnique({ where: { id: "me" } }),
    listReadingBooks(prisma),
    getSummary(prisma, "month", now),
    getYearlyBookGoal(prisma, now.getFullYear()),
    prisma.quote.findMany({
      orderBy: { createdAt: "desc" },
      take: 2,
      include: { tags: { include: { tag: true } }, book: { select: { id: true, title: true, authors: { include: { author: true } } } } },
    }),
    prisma.book.findMany({ where: { status: "COMPLETED" }, include: bookListInclude, orderBy: { finishedAt: "desc" }, take: 12 }),
    prisma.book.findMany({ where: { status: "OWNED" }, include: bookListInclude, orderBy: [{ acquiredAt: "asc" }], take: 12 }),
    prisma.book.count({ where: { status: "OWNED" } }),
    recommendNext(prisma, 10),
    prisma.book.count(),
  ]);
  const current = reading[0];

  return (
    <div className="mx-auto max-w-3xl space-y-8 pt-[calc(env(safe-area-inset-top)+1rem)] lg:pt-8">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BookNestLogo className="size-9 lg:hidden" />
          <div>
            <p className="text-xl font-bold">
              {greeting(now.getHours())}
              {user?.name ? `、${user.name}さん` : ""}
            </p>
            <p className="text-xs text-muted-foreground">{now.toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</p>
          </div>
        </div>
        <Link href="/search" aria-label="検索" className="flex size-11 items-center justify-center rounded-full hover:bg-accent">
          <Search className="size-5" />
        </Link>
      </header>

      {total === 0 ? (
        <EmptyState
          icon="📚"
          title="まだ本がありません。"
          description={
            <>
              最初の1冊を登録して、
              <br />
              あなたの読書ライブラリを作りましょう。
            </>
          }
          action={
            <Button asChild size="lg">
              <Link href="/books/new">
                <Plus /> 本を追加
              </Link>
            </Button>
          }
        />
      ) : null}

      {/* 現在読書中 */}
      <section aria-labelledby="h-reading">
        <SectionTitle action={reading.length > 1 ? <Link href="/reading" className="text-sm text-primary">すべて（{reading.length}冊）</Link> : null}>
          <span id="h-reading">📖 今読んでいる本</span>
        </SectionTitle>
        {current ? (
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex gap-4">
              <Link href={`/books/${current.id}`} className="w-20 shrink-0 sm:w-24">
                <BookCover src={current.coverImage} title={current.title} size="sm" author={authorNames(current, 1)} priority />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/books/${current.id}`}>
                  <p className="line-clamp-2 text-lg leading-snug font-bold">『{current.title}』</p>
                  <p className="line-clamp-1 text-sm text-muted-foreground">{authorNames(current)}</p>
                </Link>
                {current.pageCount ? (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-sm tabular-nums">
                      <span className="font-semibold">{current.currentPage}</span> / {current.pageCount}ページ
                      <span className="ml-2 font-semibold text-primary">{progressPercent(current.currentPage, current.pageCount)}%</span>
                    </p>
                    <Progress value={progressPercent(current.currentPage, current.pageCount)} />
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-4">
              <ReadingQuickActions book={{ id: current.id, title: current.title, status: current.status, currentPage: current.currentPage, pageCount: current.pageCount }} size="compact" />
            </div>
          </div>
        ) : total > 0 ? (
          <Link href="/tsundoku" className="flex items-center justify-between rounded-2xl border border-dashed p-4 text-sm text-muted-foreground hover:bg-accent/40">
            読書中の本はありません。積読から次の1冊を選びましょう
            <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </section>

      {/* 本日のニュース（集めるのに時間がかかることがあるので、ほかの部分を待たせない） */}
      <Suspense fallback={<TodayNewsSkeleton />}>
        <TodayNewsSection />
      </Suspense>

      {/* 今月 */}
      <section aria-labelledby="h-month">
        <SectionTitle action={<Link href="/stats?period=month" className="text-sm text-primary">統計へ</Link>}>
          <span id="h-month">📊 今月の読書</span>
        </SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat value={formatNumber(month.books)} unit="冊" label="読了" />
          <MiniStat value={formatNumber(month.pagesRead)} unit="p" label="ページ" />
          <MiniStat value={month.minutes ? (month.minutes / 60).toFixed(1) : "0"} unit="時間" label="読書時間" />
        </div>
      </section>

      {/* 年間目標 */}
      <section aria-labelledby="h-goal">
        <SectionTitle action={<Link href="/goals" className="text-sm text-primary">目標</Link>}>
          <span id="h-goal">🎯 {now.getFullYear()}年の目標</span>
        </SectionTitle>
        {goal ? (
          <Link href="/goals" className="block rounded-2xl border bg-card p-4 hover:bg-accent/30">
            <p className="text-2xl font-bold tabular-nums">
              {goal.current}
              <span className="text-base font-normal text-muted-foreground"> / {goal.target}冊</span>
            </p>
            <Progress value={progressPercent(goal.current, goal.target)} className="mt-2 h-3" label="年間目標の達成率" />
          </Link>
        ) : (
          <Link href="/goals" className="flex items-center justify-between rounded-2xl border border-dashed p-4 text-sm text-muted-foreground hover:bg-accent/40">
            年間の読書目標を設定しましょう
            <ChevronRight className="size-4" />
          </Link>
        )}
      </section>

      {/* 最近のフレーズ */}
      <section aria-labelledby="h-quotes">
        <SectionTitle action={<Link href="/quotes" className="text-sm text-primary">すべて</Link>}>
          <span id="h-quotes">💬 最近保存したフレーズ</span>
        </SectionTitle>
        {quotes.length ? (
          <div className="space-y-3">
            {quotes.map((q) => (
              <QuoteCard key={q.id} quote={q} />
            ))}
          </div>
        ) : (
          <Link href="/quotes/new" className="flex items-center justify-between rounded-2xl border border-dashed p-4 text-sm text-muted-foreground hover:bg-accent/40">
            心に残った文章を撮影して保存しましょう
            <ChevronRight className="size-4" />
          </Link>
        )}
      </section>

      {completed.length ? (
        <section aria-labelledby="h-done">
          <SectionTitle action={<Link href="/books?status=COMPLETED&sort=finishedAt" className="text-sm text-primary">すべて</Link>}>
            <span id="h-done">📚 最近読了</span>
          </SectionTitle>
          <BookRow books={completed} />
        </section>
      ) : null}

      {tsundoku.length ? (
        <section aria-labelledby="h-tsundoku">
          <SectionTitle action={<Link href="/tsundoku" className="text-sm text-primary">積読 {tsundokuCount}冊</Link>}>
            <span id="h-tsundoku">📕 積読</span>
          </SectionTitle>
          <BookRow books={tsundoku} />
        </section>
      ) : null}

      {recs.length ? (
        <section aria-labelledby="h-next">
          <SectionTitle>
            <span id="h-next">📖 次に読む候補</span>
          </SectionTitle>
          <ul className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {recs.map((r) => (
              <li key={r.book.id} className="w-[132px] shrink-0 snap-start">
                <Link href={`/books/${r.book.id}`} className="block">
                  <div className="w-24">
                    <BookCover src={r.book.coverImage} title={r.book.title} size="sm" author={authorNames(r.book, 1)} />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-snug font-medium">{r.book.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-primary">{r.reasons[0]}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function MiniStat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <p className="text-2xl font-bold tabular-nums">
        {value}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
