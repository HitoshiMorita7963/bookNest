import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { BookCover } from "@/components/books/book-cover";
import { EmptyState, authorNames } from "@/components/books/bits";
import { RandomPick } from "@/components/tsundoku/random-pick";
import { bookListInclude } from "@/server/services/books";
import { cn, formatNumber } from "@/lib/utils";

export const metadata = { title: "積読" };

const AGES = [
  { key: "", label: "すべて", days: 0 },
  { key: "1w", label: "1週間以上", days: 7 },
  { key: "1m", label: "1か月以上", days: 30 },
  { key: "3m", label: "3か月以上", days: 90 },
  { key: "6m", label: "半年以上", days: 182 },
  { key: "1y", label: "1年以上", days: 365 },
];

export default async function TsundokuPage({ searchParams }: { searchParams: Promise<{ age?: string }> }) {
  const { age = "" } = await searchParams;
  const min = AGES.find((a) => a.key === age)?.days ?? 0;
  const all = await prisma.book.findMany({ where: { status: "OWNED" }, include: bookListInclude, orderBy: [{ acquiredAt: "asc" }, { createdAt: "asc" }] });
  const now = new Date();
  const withDays = all.map((b) => ({ ...b, since: b.acquiredAt ?? b.createdAt, days: differenceInCalendarDays(now, b.acquiredAt ?? b.createdAt) }));
  const books = withDays.filter((b) => b.days >= min);
  const totalPages = all.reduce((s, b) => s + Math.max(0, (b.pageCount ?? 0) - b.currentPage), 0);
  const avgDays = withDays.length ? Math.round(withDays.reduce((s, b) => s + b.days, 0) / withDays.length) : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="積読" />
      {all.length === 0 ? (
        <EmptyState icon="📕" title="積読はありません" description="購入した本を「所有」ステータスで登録すると、ここで管理できます。" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="積読冊数" value={`${all.length}`} unit="冊" />
            <Stat label="総ページ数" value={formatNumber(totalPages)} unit="p" />
            <Stat label="平均積読期間" value={`${avgDays}`} unit="日" />
          </div>
          <RandomPick items={withDays.map((b) => ({ id: b.id, title: b.title, coverImage: b.coverImage, author: authorNames(b, 1), days: b.days }))} />
          <nav className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="積読期間">
            {AGES.map((a) => (
              <Link
                key={a.key}
                href={a.key ? `/tsundoku?age=${a.key}` : "/tsundoku"}
                className={cn("flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm", age === a.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent")}
              >
                {a.label}
              </Link>
            ))}
          </nav>
          {books.length === 0 ? (
            <p className="text-sm text-muted-foreground">該当する積読はありません。</p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {books.map((b) => (
                <li key={b.id}>
                  <Link href={`/books/${b.id}`} className="flex gap-3 p-3 hover:bg-accent/50">
                    <div className="w-12 shrink-0">
                      <BookCover src={b.coverImage} title={b.title} size="xs" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium">{b.title}</p>
                      <p className="line-clamp-1 text-sm text-muted-foreground">{authorNames(b)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        購入日 {format(b.since, "yyyy/M/d")}
                        {b.pageCount ? ` ・ ${b.pageCount}p` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 self-center text-right">
                      <p className={cn("text-lg font-bold tabular-nums", b.days >= 365 ? "text-destructive" : b.days >= 90 ? "text-amber-600 dark:text-amber-400" : "")}>{b.days}</p>
                      <p className="text-[11px] text-muted-foreground">日</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">
        {value}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}
