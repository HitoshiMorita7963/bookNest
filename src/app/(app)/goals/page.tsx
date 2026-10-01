import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/books/bits";
import { Progress } from "@/components/ui/primitives";
import { GoalActions, NewGoalButton } from "@/components/goals/goal-client";
import { listGoalsWithProgress } from "@/server/services/goals";
import { GOAL_LABEL, type GoalType } from "@/lib/constants";
import { formatNumber, progressPercent } from "@/lib/utils";

export const metadata = { title: "読書目標" };

export default async function GoalsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const year = Number(sp.year) || thisYear;
  const goals = await listGoalsWithProgress(prisma, year);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="読書目標" actions={<NewGoalButton defaultYear={year} />} />
      <div className="mb-5 flex items-center justify-between">
        <Link href={`/goals?year=${year - 1}`} className="flex size-11 items-center justify-center rounded-full hover:bg-accent" aria-label="前の年">
          <ChevronLeft />
        </Link>
        <p className="text-xl font-bold tabular-nums">{year}年</p>
        <Link href={`/goals?year=${year + 1}`} className="flex size-11 items-center justify-center rounded-full hover:bg-accent" aria-label="次の年">
          <ChevronRight />
        </Link>
      </div>
      {goals.length === 0 ? (
        <EmptyState icon="🎯" title={`${year}年の目標はまだありません`} description="年間冊数・年間ページ数・月間冊数・ジャンル別冊数の目標を設定できます。" />
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const pct = progressPercent(g.current, g.target);
            const unit = g.type === "YEARLY_PAGES" ? "ページ" : "冊";
            const ahead = g.current - g.expected;
            const title =
              g.type === "MONTHLY_BOOKS" ? `${g.month}月の冊数` : g.type === "GENRE_BOOKS" ? `${g.genre}の冊数` : GOAL_LABEL[g.type as GoalType];
            return (
              <li key={g.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      🎯 {g.year}年 {title}
                    </p>
                    <p className="mt-1 text-3xl font-bold tabular-nums">
                      {formatNumber(g.current)}
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}
                        / {formatNumber(g.target)}
                        {unit}
                      </span>
                    </p>
                  </div>
                  <GoalActions id={g.id} target={g.target} />
                </div>
                <Progress value={pct} className="mt-3 h-3" label={`${title}の達成率 ${pct}%`} />
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{pct}% 達成</span>
                  {g.current >= g.target ? (
                    <span className="font-medium text-primary">🎉 達成しました</span>
                  ) : g.elapsedRatio < 1 && g.elapsedRatio > 0 ? (
                    <span>{ahead >= 0 ? `ペースより ${formatNumber(ahead)}${unit} 先行` : `ペースまで あと ${formatNumber(-ahead)}${unit}`}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
