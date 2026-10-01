import Link from "next/link";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { ReadingHeatmap } from "@/components/stats/heatmap";
import { StatTile } from "@/components/stats/period-tabs";
import { Card, CardContent } from "@/components/ui/primitives";
import { getDailyActivity } from "@/server/services/stats";
import { formatNumber } from "@/lib/utils";

export const metadata = { title: "読書カレンダー" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = Math.min(thisYear, Math.max(1990, Number(sp.year) || thisYear));
  const from = new Date(year, 0, 1);
  const to = year === thisYear ? new Date() : new Date(year, 11, 31, 23, 59, 59);
  const activity = await getDailyActivity(prisma, from, to);
  const days = Object.values(activity);
  const pages = days.reduce((s, d) => s + d.pages, 0);
  const minutes = days.reduce((s, d) => s + d.minutes, 0);
  const best = Object.entries(activity).sort((a, b) => b[1].pages - a[1].pages)[0];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="読書カレンダー" back="/stats" />
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Link href={`/calendar?year=${year - 1}`} className="flex size-11 items-center justify-center rounded-full hover:bg-accent" aria-label="前の年">
            <ChevronLeft />
          </Link>
          <p className="text-xl font-bold tabular-nums">{year}年</p>
          {year < thisYear ? (
            <Link href={`/calendar?year=${year + 1}`} className="flex size-11 items-center justify-center rounded-full hover:bg-accent" aria-label="次の年">
              <ChevronRight />
            </Link>
          ) : (
            <span className="size-11" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label="読書した日" value={String(days.length)} unit="日" />
          <StatTile label="ページ" value={formatNumber(pages)} unit="p" />
          <StatTile label="読書時間" value={minutes ? (minutes / 60).toFixed(1) : "—"} unit={minutes ? "時間" : undefined} />
          <StatTile label="最もよく読んだ日" value={best ? format(new Date(best[0]), "M/d") : "—"} sub={best ? `${best[1].pages}ページ` : undefined} />
        </div>
        <Card>
          <CardContent>
            <ReadingHeatmap activity={activity} from={format(from, "yyyy-MM-dd")} to={format(to, "yyyy-MM-dd")} />
            <p className="mt-3 text-xs text-muted-foreground">日付をタップすると、その日に読んだ本とメモを確認できます。</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
