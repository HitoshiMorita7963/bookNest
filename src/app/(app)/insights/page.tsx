import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodTabs, StatTile } from "@/components/stats/period-tabs";
import { BarList } from "@/components/stats/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { TagChip } from "@/components/books/bits";
import { INSIGHT_PERIOD_LABEL, analyzeTrends, type InsightPeriod } from "@/server/services/insights";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "読書傾向" };

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period: InsightPeriod = sp.period && sp.period in INSIGHT_PERIOD_LABEL ? (sp.period as InsightPeriod) : "1y";
  const a = await analyzeTrends(prisma, period);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="読書傾向分析" back="/stats" />
      <div className="space-y-5">
        <PeriodTabs value={period} options={INSIGHT_PERIOD_LABEL} base="/insights" />
        <Card>
          <CardHeader>
            <CardTitle>📝 あなたの登録データから見えること</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-[15px] leading-relaxed">
              {a.observations.map((o, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary" aria-hidden>
                    •
                  </span>
                  {o}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">※ 読了記録・ジャンル・タグ・保存フレーズの集計にもとづく機械的な分析です。</p>
          </CardContent>
        </Card>


        <div className="grid grid-cols-3 gap-3">
          <StatTile label="平均評価" value={a.avgRating ? a.avgRating.toFixed(1) : "—"} unit={a.avgRating ? "★" : undefined} />
          <StatTile label="平均ページ数" value={a.avgPages ? formatNumber(a.avgPages) : "—"} unit={a.avgPages ? "p" : undefined} />
          <StatTile label="平均読了日数" value={a.avgDays ? a.avgDays.toFixed(1) : "—"} unit={a.avgDays ? "日" : undefined} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>よく読むジャンル</CardTitle>
            </CardHeader>
            <CardContent>{a.genres.length ? <BarList data={a.genres.slice(0, 8).map((g) => ({ name: g.name, value: g.count }))} unit="冊" /> : <Empty />}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>よく読む著者</CardTitle>
            </CardHeader>
            <CardContent>{a.authors.length ? <BarList data={a.authors.map((g) => ({ name: g.name, value: g.count }))} unit="冊" /> : <Empty />}</CardContent>
          </Card>
          {period !== "all" ? (
            <Card>
              <CardHeader>
                <CardTitle>最近増えた・減ったジャンル</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-xs text-muted-foreground">前の{INSIGHT_PERIOD_LABEL[period]}との比較</p>
                {a.increased.length || a.decreased.length ? (
                  <ul className="space-y-1.5">
                    {a.increased.map((c) => (
                      <li key={c.name} className="flex justify-between">
                        <span>↑ {c.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {c.before} → {c.now}冊
                        </span>
                      </li>
                    ))}
                    {a.decreased.map((c) => (
                      <li key={c.name} className="flex justify-between">
                        <span>↓ {c.name}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {c.before} → {c.now}冊
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty />
                )}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>出版年代</CardTitle>
            </CardHeader>
            <CardContent>{a.eras.length ? <BarList data={a.eras.map((g) => ({ name: g.name, value: g.count }))} unit="冊" /> : <Empty />}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>よく読むテーマ（タグ）</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {a.tags.length ? a.tags.map((t) => <TagChip key={t.name} name={`${t.name} ${t.count}`} href={`/books?tag=${encodeURIComponent(t.name)}`} />) : <Empty />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>保存フレーズの傾向</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {a.quoteTags.length ? a.quoteTags.map((t) => <TagChip key={t.name} name={`${t.name} ${t.count}`} href={`/quotes?tag=${encodeURIComponent(t.name)}`} />) : <Empty />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground">データがありません</p>;
}
