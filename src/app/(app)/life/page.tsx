import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { lifeSummary } from "@/server/services/insights";
import { getYearlySeries } from "@/server/services/stats";
import { PageHeader } from "@/components/layout/page-header";
import { BookCover } from "@/components/books/book-cover";
import { SectionTitle } from "@/components/books/bits";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "私の読書人生" };

export default async function LifePage() {
  const [s, years] = await Promise.all([lifeSummary(prisma), getYearlySeries(prisma)]);
  const maxBooks = Math.max(1, ...years.map((y) => y.books));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="📚 私の読書人生" back="/stats" />
      <div className="space-y-8">
        <section className="rounded-3xl bg-gradient-to-br from-primary/90 to-primary p-6 text-primary-foreground shadow-md">
          {s.since ? <p className="text-sm opacity-80">{format(s.since, "yyyy年M月")}からの記録</p> : null}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6">
            <Big label="読んだ本" value={formatNumber(s.completed)} unit="冊" />
            <Big label="読んだページ" value={formatNumber(s.pages)} unit="ページ" />
            <Big label="保存したフレーズ" value={formatNumber(s.quotes)} unit="件" />
            <Big label="学んだ知識" value={formatNumber(s.knowledge)} unit="件" />
          </dl>
          <dl className="mt-6 space-y-2 border-t border-primary-foreground/20 pt-4 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="opacity-80">最も読んだジャンル</dt>
              <dd className="font-semibold">{s.topGenre ? `${s.topGenre.name}（${s.topGenre.count}冊）` : "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="opacity-80">最も読んだ著者</dt>
              <dd className="font-semibold">{s.topAuthor ? `${s.topAuthor.name}（${s.topAuthor.count}冊）` : "—"}</dd>
            </div>
            {s.longest ? (
              <div className="flex justify-between gap-2">
                <dt className="opacity-80">いちばん厚い本</dt>
                <dd className="truncate font-semibold">
                  『{s.longest.title}』{s.longest.pageCount}p
                </dd>
              </div>
            ) : null}
            {s.minutes ? (
              <div className="flex justify-between gap-2">
                <dt className="opacity-80">記録した読書時間</dt>
                <dd className="font-semibold">{formatNumber(s.minutes / 60)}時間</dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section>
          <SectionTitle>年ごとの読書</SectionTitle>
          {years.length ? (
            <ol className="space-y-3">
              {[...years].reverse().map((y) => (
                <li key={y.year} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={`/books?finishedYear=${y.year}&status=COMPLETED`} className="text-lg font-bold tabular-nums hover:underline">
                      {y.year}
                    </Link>
                    <p className="text-2xl font-bold tabular-nums">
                      {y.books}
                      <span className="text-sm font-normal text-muted-foreground">冊</span>
                    </p>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(y.books / maxBooks) * 100}%` }} />
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div>
                      <dt className="text-muted-foreground">ページ</dt>
                      <dd className="text-sm font-semibold tabular-nums">{formatNumber(y.pages)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">平均評価</dt>
                      <dd className="text-sm font-semibold tabular-nums">{y.avgRating ? `★${y.avgRating.toFixed(1)}` : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">フレーズ</dt>
                      <dd className="text-sm font-semibold tabular-nums">{y.quotes}</dd>
                    </div>
                  </dl>
                  {y.topGenres.length ? <p className="mt-2 text-xs text-muted-foreground">ジャンル：{y.topGenres.map((g) => `${g.name}(${g.count})`).join("・")}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">読了した本が増えると、年ごとの記録が表示されます。</p>
          )}
        </section>

        {s.best.length ? (
          <section>
            <SectionTitle>★5をつけた本</SectionTitle>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {s.best.map((b) => (
                <li key={b.id}>
                  <Link href={`/books/${b.id}`}>
                    <BookCover src={b.coverImage} title={b.title} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Big({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <dt className="text-xs opacity-80">{label}</dt>
      <dd className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
        {value}
        <span className="ml-1 text-sm font-normal opacity-80">{unit}</span>
      </dd>
    </div>
  );
}
