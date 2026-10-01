import { addDays, differenceInCalendarDays, format, startOfDay, startOfMonth, startOfYear, subDays, subMonths, subYears } from "date-fns";
import type { Db } from "@/lib/db";

export type Period = "month" | "year" | "last12" | "all";
export const PERIOD_LABEL: Record<Period, string> = { month: "今月", year: "今年", last12: "過去1年", all: "全期間" };

export function periodRange(period: Period, now = new Date()): { from: Date | null; to: Date } {
  const to = now;
  switch (period) {
    case "month":
      return { from: startOfMonth(now), to };
    case "year":
      return { from: startOfYear(now), to };
    case "last12":
      return { from: startOfMonth(subMonths(now, 11)), to };
    default:
      return { from: null, to };
  }
}

/** 期間内に読了した読書記録（再読も1回として数える） */
async function completedRecords(db: Db, from: Date | null, to: Date) {
  return db.readingRecord.findMany({
    where: { status: "COMPLETED", finishedAt: { not: null, ...(from ? { gte: from } : {}), lte: to } },
    select: {
      id: true,
      startedAt: true,
      finishedAt: true,
      rating: true,
      book: { select: { id: true, pageCount: true, genre: true, authors: { select: { author: { select: { id: true, name: true } } } } } },
    },
  });
}

async function sessionsIn(db: Db, from: Date | null, to: Date) {
  return db.readingSession.findMany({
    where: { date: { ...(from ? { gte: from } : {}), lte: to } },
    select: { date: true, pagesRead: true, minutes: true },
  });
}

type CompletedRecord = Awaited<ReturnType<typeof completedRecords>>[number];
type SessionRow = Awaited<ReturnType<typeof sessionsIn>>[number];

export async function getSummary(db: Db, period: Period, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const [records, sessions] = await Promise.all([completedRecords(db, from, to), sessionsIn(db, from, to)]);
  return summarize(records, sessions);
}

function summarize(records: CompletedRecord[], sessions: SessionRow[]) {
  const pagesRead = sessions.reduce((s, x) => s + x.pagesRead, 0);
  const minutes = sessions.reduce((s, x) => s + (x.minutes ?? 0), 0);
  const durations = records
    .filter((r) => r.startedAt && r.finishedAt)
    .map((r) => Math.max(1, differenceInCalendarDays(r.finishedAt!, r.startedAt!) + 1));
  const rated = records.filter((r) => r.rating != null);
  const withPages = records.filter((r) => r.book.pageCount);
  return {
    books: records.length,
    completedPages: withPages.reduce((s, r) => s + (r.book.pageCount ?? 0), 0),
    pagesRead,
    minutes,
    avgRating: rated.length ? rated.reduce((s, r) => s + r.rating!, 0) / rated.length : null,
    avgDays: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    avgPages: withPages.length ? withPages.reduce((s, r) => s + (r.book.pageCount ?? 0), 0) / withPages.length : null,
    records,
  };
}

/** 月別の読了冊数・ページ数 */
export async function getMonthlySeries(db: Db, period: Period, now = new Date()) {
  let { from } = periodRange(period, now);
  const to = now;
  if (period === "month") from = startOfMonth(subMonths(now, 5)); // 今月表示時も直近6か月の推移を見せる
  if (!from) {
    const first = await db.readingRecord.findFirst({ where: { finishedAt: { not: null } }, orderBy: { finishedAt: "asc" }, select: { finishedAt: true } });
    const firstSession = await db.readingSession.findFirst({ orderBy: { date: "asc" }, select: { date: true } });
    const candidates = [first?.finishedAt, firstSession?.date].filter(Boolean) as Date[];
    from = startOfMonth(candidates.length ? new Date(Math.min(...candidates.map((d) => d.getTime()))) : subMonths(now, 11));
    if (differenceInCalendarDays(now, from) < 330) from = startOfMonth(subMonths(now, 11));
  }
  const [records, sessions] = await Promise.all([completedRecords(db, from, to), sessionsIn(db, from, to)]);
  const months: { key: string; label: string; books: number; pages: number }[] = [];
  for (let d = startOfMonth(from); d <= to; d = startOfMonth(addDays(d, 32))) {
    months.push({ key: format(d, "yyyy-MM"), label: format(d, "yy/M"), books: 0, pages: 0 });
  }
  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const r of records) {
    const i = idx.get(format(r.finishedAt!, "yyyy-MM"));
    if (i != null) months[i].books++;
  }
  for (const s of sessions) {
    const i = idx.get(format(s.date, "yyyy-MM"));
    if (i != null) months[i].pages += s.pagesRead;
  }
  return months;
}

/** 年別の読了冊数・ページ数・評価・フレーズ数（読書人生ページ用） */
export async function getYearlySeries(db: Db) {
  const [records, sessions, quotes, knowledge] = await Promise.all([
    completedRecords(db, null, new Date()),
    db.readingSession.findMany({ select: { date: true, pagesRead: true } }),
    db.quote.findMany({ select: { createdAt: true } }),
    db.knowledgeNote.findMany({ select: { createdAt: true } }),
  ]);
  const years = new Map<number, { year: number; books: number; pages: number; ratings: number[]; quotes: number; knowledge: number; genres: Map<string, number> }>();
  const get = (y: number) => {
    if (!years.has(y)) years.set(y, { year: y, books: 0, pages: 0, ratings: [], quotes: 0, knowledge: 0, genres: new Map() });
    return years.get(y)!;
  };
  for (const r of records) {
    const y = get(r.finishedAt!.getFullYear());
    y.books++;
    if (r.rating) y.ratings.push(r.rating);
    const g = r.book.genre ?? "未分類";
    y.genres.set(g, (y.genres.get(g) ?? 0) + 1);
  }
  for (const s of sessions) get(s.date.getFullYear()).pages += s.pagesRead;
  for (const q of quotes) get(q.createdAt.getFullYear()).quotes++;
  for (const k of knowledge) get(k.createdAt.getFullYear()).knowledge++;
  return [...years.values()]
    .sort((a, b) => a.year - b.year)
    .map((y) => ({
      year: y.year,
      books: y.books,
      pages: y.pages,
      quotes: y.quotes,
      knowledge: y.knowledge,
      avgRating: y.ratings.length ? y.ratings.reduce((a, b) => a + b, 0) / y.ratings.length : null,
      topGenres: [...y.genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, count]) => ({ name, count })),
    }));
}

export async function getGenreDistribution(db: Db, period: Period, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const records = await completedRecords(db, from, to);
  const map = new Map<string, number>();
  for (const r of records) {
    const g = r.book.genre ?? "未分類";
    map.set(g, (map.get(g) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export async function getRatingDistribution(db: Db, period: Period, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const records = await completedRecords(db, from, to);
  return [5, 4, 3, 2, 1].map((r) => ({ rating: r, label: "★".repeat(r), count: records.filter((x) => x.rating === r).length }));
}

/** 読書カレンダー（ヒートマップ）用の日別データ */
export async function getDailyActivity(db: Db, from: Date, to: Date) {
  const sessions = await db.readingSession.findMany({
    where: { date: { gte: startOfDay(from), lte: to } },
    select: { date: true, pagesRead: true, minutes: true, bookId: true, note: true },
  });
  const map = new Map<string, { pages: number; minutes: number; sessions: number; books: Set<string> }>();
  for (const s of sessions) {
    const k = format(s.date, "yyyy-MM-dd");
    if (!map.has(k)) map.set(k, { pages: 0, minutes: 0, sessions: 0, books: new Set() });
    const v = map.get(k)!;
    v.pages += s.pagesRead;
    v.minutes += s.minutes ?? 0;
    v.sessions++;
    v.books.add(s.bookId);
  }
  return Object.fromEntries([...map.entries()].map(([k, v]) => [k, { pages: v.pages, minutes: v.minutes, sessions: v.sessions, books: v.books.size }]));
}

export async function getStreak(db: Db, now = new Date()) {
  const activity = await getDailyActivity(db, subYears(now, 1), now);
  let streak = 0;
  let d = startOfDay(now);
  if (!activity[format(d, "yyyy-MM-dd")]) d = addDays(d, -1); // 今日まだ読んでいなくても昨日まで続いていれば継続
  while (activity[format(d, "yyyy-MM-dd")]) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

export async function getTopAuthors(db: Db, period: Period, take = 5, now = new Date()) {
  const { from, to } = periodRange(period, now);
  const records = await completedRecords(db, from, to);
  const map = new Map<string, { id: string; name: string; count: number }>();
  for (const r of records) {
    for (const { author } of r.book.authors) {
      const v = map.get(author.id) ?? { id: author.id, name: author.name, count: 0 };
      v.count++;
      map.set(author.id, v);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, take);
}

/**
 * 統計ページ用：DB への問い合わせを2回（読了記録・読書セッション）にまとめ、
 * 期間別の集計・月別推移・ジャンル・評価・ヒートマップ・連続日数をメモリ上で計算する。
 * （クラウド DB では問い合わせ回数がそのまま表示速度に影響するため）
 */
export async function getStatsPageData(db: Db, period: Period, now = new Date()) {
  const { from } = periodRange(period, now);
  const yearStart = startOfYear(now);
  const heatFrom = startOfDay(subDays(now, 364));
  const monthlyFrom = period === "month" ? startOfMonth(subMonths(now, 5)) : from;
  // 必要な範囲のうち最も古い日付からまとめて取得
  const candidates = [from, yearStart, heatFrom, monthlyFrom];
  const earliest = candidates.includes(null) ? null : new Date(Math.min(...candidates.map((d) => d!.getTime())));
  const [records, sessions] = await Promise.all([completedRecords(db, earliest, now), sessionsIn(db, earliest, now)]);

  const inRange = <T,>(rows: T[], get: (r: T) => Date, start: Date | null) => (start ? rows.filter((r) => get(r) >= start) : rows);
  const pRecords = inRange(records, (r) => r.finishedAt!, from);
  const pSessions = inRange(sessions, (s) => s.date, from);

  // 月別推移
  let mFrom = monthlyFrom;
  if (!mFrom) {
    const dates = [...records.map((r) => r.finishedAt!), ...sessions.map((s) => s.date)];
    mFrom = startOfMonth(dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : subMonths(now, 11));
    if (differenceInCalendarDays(now, mFrom) < 330) mFrom = startOfMonth(subMonths(now, 11));
  }
  const monthly: { key: string; label: string; books: number; pages: number }[] = [];
  for (let d = startOfMonth(mFrom); d <= now; d = startOfMonth(addDays(d, 32))) monthly.push({ key: format(d, "yyyy-MM"), label: format(d, "yy/M"), books: 0, pages: 0 });
  const idx = new Map(monthly.map((m, i) => [m.key, i]));
  for (const r of records) {
    const i = idx.get(format(r.finishedAt!, "yyyy-MM"));
    if (i != null) monthly[i].books++;
  }
  for (const s of sessions) {
    const i = idx.get(format(s.date, "yyyy-MM"));
    if (i != null) monthly[i].pages += s.pagesRead;
  }

  // ジャンル・評価
  const genreMap = new Map<string, number>();
  for (const r of pRecords) genreMap.set(r.book.genre ?? "未分類", (genreMap.get(r.book.genre ?? "未分類") ?? 0) + 1);
  const genres = [...genreMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const ratings = [5, 4, 3, 2, 1].map((r) => ({ rating: r, label: "★".repeat(r), count: pRecords.filter((x) => x.rating === r).length }));

  // ヒートマップ（過去1年）と連続読書日数
  const activity: Record<string, { pages: number; minutes: number; sessions: number; books: number }> = {};
  for (const s of sessions) {
    if (s.date < heatFrom) continue;
    const k = format(s.date, "yyyy-MM-dd");
    const v = (activity[k] ??= { pages: 0, minutes: 0, sessions: 0, books: 0 });
    v.pages += s.pagesRead;
    v.minutes += s.minutes ?? 0;
    v.sessions++;
  }
  let streak = 0;
  let d = startOfDay(now);
  if (!activity[format(d, "yyyy-MM-dd")]) d = addDays(d, -1);
  while (activity[format(d, "yyyy-MM-dd")]) {
    streak++;
    d = addDays(d, -1);
  }

  return {
    summary: summarize(pRecords, pSessions),
    yearSummary: summarize(
      records.filter((r) => r.finishedAt! >= yearStart),
      sessions.filter((s) => s.date >= yearStart),
    ),
    monthly,
    genres,
    ratings,
    activity,
    streak,
  };
}
