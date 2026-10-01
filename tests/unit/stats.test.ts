import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createBook } from "@/server/services/books";
import { finishReading, startReading, updateProgress } from "@/server/services/reading";
import { getDailyActivity, getGenreDistribution, getMonthlySeries, getRatingDistribution, getSummary, getYearlySeries } from "@/server/services/stats";
import { createGoal, listGoalsWithProgress } from "@/server/services/goals";
import { addBookToPath, createPath, getPath, listPaths, moveBookInPath, removeBookFromPath } from "@/server/services/paths";
import { recommendNext } from "@/server/services/recommend";
import { analyzeTrends } from "@/server/services/insights";

beforeEach(resetDb);

async function readBook(title: string, pages: number, rating: number, genre: string, finishedAt: string) {
  const b = await createBook(db, { title, pageCount: pages, genre, status: "OWNED" });
  await startReading(db, b.id);
  await updateProgress(db, b.id, { currentPage: Math.floor(pages / 2), date: finishedAt });
  await finishReading(db, b.id, { rating, finishedAt, startedAt: new Date(new Date(finishedAt).getTime() - 4 * 86400000) });
  return b;
}

describe("Statistics", () => {
  it("counts completed books, pages and ratings in a period", async () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 12).toISOString();
    await readBook("A", 200, 5, "小説", thisMonth);
    await readBook("B", 300, 3, "歴史", thisMonth);
    await readBook("C", 100, 4, "小説", new Date(now.getFullYear() - 2, 5, 1).toISOString());

    const month = await getSummary(db, "month", now);
    expect(month.books).toBe(2);
    expect(month.completedPages).toBe(500);
    expect(month.avgRating).toBe(4);
    expect(month.avgDays).toBe(5);

    const all = await getSummary(db, "all", now);
    expect(all.books).toBe(3);
    expect(all.pagesRead).toBe(600); // セッション（進捗 + 読了時の残り）の合計

    const genres = await getGenreDistribution(db, "all", now);
    expect(genres[0]).toEqual({ name: "小説", value: 2 });
    const ratings = await getRatingDistribution(db, "all", now);
    expect(ratings.find((r) => r.rating === 5)?.count).toBe(1);

    const monthly = await getMonthlySeries(db, "last12", now);
    expect(monthly).toHaveLength(12);
    expect(monthly[monthly.length - 1].books).toBe(2);

    const years = await getYearlySeries(db);
    expect(years.map((y) => y.books)).toEqual([1, 2]);

    const activity = await getDailyActivity(db, new Date(now.getFullYear(), now.getMonth(), 1), now);
    expect(Object.values(activity).reduce((s, d) => s + d.pages, 0)).toBe(500);
  });

  it("counts rereads separately", async () => {
    const b = await readBook("再読本", 100, 4, "小説", "2025-01-10T12:00:00");
    await startReading(db, b.id);
    await finishReading(db, b.id, { rating: 5, finishedAt: "2025-06-10T12:00:00" });
    const years = await getYearlySeries(db);
    expect(years.find((y) => y.year === 2025)?.books).toBe(2);
  });

  it("trend analysis produces data-based observations", async () => {
    const now = new Date();
    await readBook("A", 200, 5, "政治", now.toISOString());
    await readBook("B", 200, 4, "政治", now.toISOString());
    const a = await analyzeTrends(db, "3m", now);
    expect(a.total).toBe(2);
    expect(a.observations.join("")).toContain("政治");
    expect(a.increased[0]).toMatchObject({ name: "政治", diff: 2 });
  });
});

describe("Goals", () => {
  it("tracks yearly books, pages and genre goals", async () => {
    const year = new Date().getFullYear();
    const when = new Date(year, 0, 15, 12).toISOString();
    await readBook("A", 250, 5, "経済", when);
    await createGoal(db, { type: "YEARLY_BOOKS", year, target: 10 });
    await createGoal(db, { type: "YEARLY_PAGES", year, target: 1000 });
    await createGoal(db, { type: "GENRE_BOOKS", year, genre: "経済", target: 3 });
    await createGoal(db, { type: "MONTHLY_BOOKS", year, month: 1, target: 2 });
    await expect(createGoal(db, { type: "YEARLY_BOOKS", year, target: 5 })).rejects.toMatchObject({ code: "DUPLICATE" });
    const goals = await listGoalsWithProgress(db, year);
    const byType = Object.fromEntries(goals.map((g) => [g.type, g.current]));
    expect(byType).toEqual({ YEARLY_BOOKS: 1, YEARLY_PAGES: 250, GENRE_BOOKS: 1, MONTHLY_BOOKS: 1 });
  });
});

describe("Reading paths & recommendations", () => {
  it("orders books, tracks progress and recommends the next one", async () => {
    const a = await createBook(db, { title: "経済の基本", status: "COMPLETED" });
    const b = await createBook(db, { title: "日本経済", status: "OWNED" });
    const c = await createBook(db, { title: "金融政策", status: "WANT_TO_READ" });
    const p = await createPath(db, { title: "政治・経済入門", bookIds: [a.id, b.id] });
    await addBookToPath(db, p.id, c.id);
    await moveBookInPath(db, p.id, c.id, -1);
    let path = await getPath(db, p.id);
    expect(path?.books.map((x) => x.book.title)).toEqual(["経済の基本", "金融政策", "日本経済"]);
    expect(path?.nextIdx).toBe(1);
    const [listed] = await listPaths(db);
    expect(listed.done).toBe(1);
    expect(listed.next?.title).toBe("金融政策");

    const recs = await recommendNext(db);
    expect(recs[0].book.title).toBe("金融政策");
    expect(recs[0].reasons[0]).toContain("読書ルート");

    await removeBookFromPath(db, p.id, c.id);
    path = await getPath(db, p.id);
    expect(path?.books.map((x) => x.position)).toEqual([0, 1]);
  });

  it("recommends the next volume of a series", async () => {
    await createBook(db, { title: "1巻", seriesTitle: "S", seriesNumber: 1, status: "COMPLETED" });
    await createBook(db, { title: "2巻", seriesTitle: "S", seriesNumber: 2, status: "OWNED" });
    const recs = await recommendNext(db);
    expect(recs[0].book.title).toBe("2巻");
    expect(recs[0].reasons.join()).toContain("シリーズ");
  });
});

describe("Stats page data (single-pass)", () => {
  it("matches the individual stat functions for every period", async () => {
    const { loadSampleData } = await import("@/server/services/sample");
    const { getStatsPageData, getStreak } = await import("@/server/services/stats");
    await loadSampleData(db);
    const now = new Date();
    for (const period of ["month", "year", "last12", "all"] as const) {
      const d = await getStatsPageData(db, period, now);
      const s = await getSummary(db, period, now);
      expect({ ...d.summary, records: d.summary.records.length }).toEqual({ ...s, records: s.records.length });
      expect({ period, m: d.monthly.map((x) => x.key) }).toEqual({ period, m: (await getMonthlySeries(db, period, now)).map((x) => x.key) });
      expect(d.monthly).toEqual(await getMonthlySeries(db, period, now));
      expect(d.genres).toEqual(await getGenreDistribution(db, period, now));
      expect(d.ratings).toEqual(await getRatingDistribution(db, period, now));
      expect(d.yearSummary.books).toBe((await getSummary(db, "year", now)).books);
      expect(d.streak).toBe(await getStreak(db, now));
    }
  });
});
