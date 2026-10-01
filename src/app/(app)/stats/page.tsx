import Link from "next/link";
import { format, subDays } from "date-fns";
import { CalendarDays, Target, TrendingUp, Sparkles, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodTabs, StatTile } from "@/components/stats/period-tabs";
import { BarList, ColumnChart } from "@/components/stats/charts";
import { ReadingHeatmap } from "@/components/stats/heatmap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { EmptyState } from "@/components/books/bits";
import { PERIOD_LABEL, getStatsPageData, type Period } from "@/server/services/stats";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "統計" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: Period = sp.period && sp.period in PERIOD_LABEL ? (sp.period as Period) : "year";
  const now = new Date();
  const { summary, monthly, genres, ratings, activity, streak, yearSummary } = await getStatsPageData(prisma, period, now);
  const hasAny = summary.books > 0 || summary.pagesRead > 0;

  return (
    <div>
      <PageHeader title="統計" />
      <div className="space-y-5">
        <PeriodTabs value={period} options={PERIOD_LABEL} base="/stats" />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="読了冊数" value={formatNumber(summary.books)} unit="冊" />
          <StatTile label="読んだページ" value={formatNumber(summary.pagesRead)} unit="p" />
          <StatTile label="平均評価" value={summary.avgRating ? summary.avgRating.toFixed(1) : "—"} unit={summary.avgRating ? "★" : undefined} />
          <StatTile label="平均読了日数" value={summary.avgDays ? summary.avgDays.toFixed(1) : "—"} unit={summary.avgDays ? "日" : undefined} />
          <StatTile label="平均ページ数" value={summary.avgPages ? formatNumber(summary.avgPages) : "—"} unit={summary.avgPages ? "p" : undefined} />
          <StatTile label="読書時間" value={summary.minutes ? (summary.minutes / 60).toFixed(1) : "—"} unit={summary.minutes ? "時間" : undefined} sub="記録した分のみ" />
          <StatTile label="今年の読了" value={formatNumber(yearSummary.books)} unit="冊" sub={`${formatNumber(yearSummary.pagesRead)}ページ`} />
          <StatTile label="連続読書" value={String(streak)} unit="日" />
        </div>

        {!hasAny ? (
          <EmptyState icon="📊" title={`${PERIOD_LABEL[period]}の記録はまだありません`} description="本を読み進めて進捗を記録したり、読了すると統計が表示されます。" />
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>月別読了冊数</CardTitle>
            </CardHeader>
            <CardContent>
              <ColumnChart data={monthly} xKey="label" yKey="books" unit="冊" label="月別読了冊数のグラフ" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>月別ページ数</CardTitle>
            </CardHeader>
            <CardContent>
              <ColumnChart data={monthly} xKey="label" yKey="pages" unit="ページ" label="月別ページ数のグラフ" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>ジャンル別</CardTitle>
            </CardHeader>
            <CardContent>
              {genres.length ? <BarList data={genres.slice(0, 10)} unit="冊" /> : <p className="text-sm text-muted-foreground">読了した本がありません</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>評価分布</CardTitle>
            </CardHeader>
            <CardContent>
              <BarList data={ratings.map((r) => ({ name: r.label, value: r.count }))} unit="冊" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <CalendarDays className="size-5 text-primary" /> 読書カレンダー（過去1年）
            </CardTitle>
            <Link href="/calendar" className="text-sm text-primary hover:underline">
              詳しく
            </Link>
          </CardHeader>
          <CardContent>
            <ReadingHeatmap activity={activity} from={format(subDays(now, 364), "yyyy-MM-dd")} to={format(now, "yyyy-MM-dd")} />
          </CardContent>
        </Card>

        <details className="rounded-xl border bg-card">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-medium">月別データを表で見る</summary>
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1.5 font-normal">月</th>
                  <th className="py-1.5 text-right font-normal">読了冊数</th>
                  <th className="py-1.5 text-right font-normal">ページ数</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr key={m.key} className="border-t">
                    <td className="py-1.5">{m.key}</td>
                    <td className="py-1.5 text-right">{m.books}</td>
                    <td className="py-1.5 text-right">{formatNumber(m.pages)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <nav className="grid gap-2 sm:grid-cols-3">
          {[
            { href: "/goals", label: "読書目標", icon: Target },
            { href: "/insights", label: "読書傾向分析", icon: TrendingUp },
            { href: "/life", label: "私の読書人生", icon: Sparkles },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 hover:bg-accent/50">
              <l.icon className="size-5 text-primary" />
              <span className="flex-1 font-medium">{l.label}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
