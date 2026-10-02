import type { Db } from "@/lib/db";
import { goalInputSchema } from "@/lib/validators";
import { AppError, DuplicateError } from "@/lib/errors";
import type { GoalType } from "@/lib/constants";
import { pagesInRange } from "./stats";

export async function createGoal(db: Db, input: unknown) {
  const data = goalInputSchema.parse(input);
  const month = data.type === "MONTHLY_BOOKS" ? (data.month ?? new Date().getMonth() + 1) : null;
  const genre = data.type === "GENRE_BOOKS" ? data.genre : null;
  if (data.type === "GENRE_BOOKS" && !genre) throw new AppError("ジャンルを入力してください", "VALIDATION");
  const dup = await db.readingGoal.findFirst({ where: { type: data.type, year: data.year, month, genre } });
  if (dup) throw new DuplicateError("同じ目標が既に設定されています");
  return db.readingGoal.create({ data: { type: data.type, year: data.year, month, genre, target: data.target } });
}

export async function updateGoalTarget(db: Db, id: string, target: number) {
  if (!Number.isInteger(target) || target < 1 || target > 1_000_000) throw new AppError("目標値は1以上の整数で入力してください", "VALIDATION");
  return db.readingGoal.update({ where: { id }, data: { target } });
}

export async function deleteGoal(db: Db, id: string) {
  await db.readingGoal.delete({ where: { id } });
}

export async function goalProgress(db: Db, goal: { type: string; year: number; month: number | null; genre: string | null }) {
  const type = goal.type as GoalType;
  const from = new Date(goal.year, type === "MONTHLY_BOOKS" ? (goal.month ?? 1) - 1 : 0, 1);
  const to = type === "MONTHLY_BOOKS" ? new Date(goal.year, goal.month ?? 1, 1) : new Date(goal.year + 1, 0, 1);
  if (type === "YEARLY_PAGES") {
    return pagesInRange(db, from, new Date(to.getTime() - 1));
  }
  return db.readingRecord.count({
    where: {
      status: "COMPLETED",
      finishedAt: { gte: from, lt: to },
      ...(type === "GENRE_BOOKS" && goal.genre ? { book: { genre: goal.genre } } : {}),
    },
  });
}

export async function listGoalsWithProgress(db: Db, year?: number) {
  const goals = await db.readingGoal.findMany({
    where: year ? { year } : {},
    orderBy: [{ year: "desc" }, { type: "asc" }, { month: "asc" }],
  });
  const now = new Date();
  return Promise.all(
    goals.map(async (g) => {
      const current = await goalProgress(db, g);
      // 期待ペース：経過割合に対する目標値
      const start = new Date(g.year, g.type === "MONTHLY_BOOKS" ? (g.month ?? 1) - 1 : 0, 1);
      const end = g.type === "MONTHLY_BOOKS" ? new Date(g.year, g.month ?? 1, 1) : new Date(g.year + 1, 0, 1);
      const ratio = Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
      return { ...g, current, expected: Math.round(g.target * ratio), elapsedRatio: ratio };
    }),
  );
}

export async function getYearlyBookGoal(db: Db, year = new Date().getFullYear()) {
  const goal = await db.readingGoal.findFirst({ where: { type: "YEARLY_BOOKS", year } });
  if (!goal) return null;
  return { ...goal, current: await goalProgress(db, goal) };
}
