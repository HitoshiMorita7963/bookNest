/**
 * 読書傾向分析（ルールベース）
 * 断定せず、登録データから読み取れる事実として表現する。
 */
import { differenceInCalendarDays, subMonths } from "date-fns";
import type { Db } from "@/lib/db";
import { pagesInRange } from "./stats";

export type InsightPeriod = "3m" | "1y" | "all";
export const INSIGHT_PERIOD_LABEL: Record<InsightPeriod, string> = { "3m": "3か月", "1y": "1年", all: "全期間" };

function rangeOf(period: InsightPeriod, now: Date) {
  if (period === "3m") return { from: subMonths(now, 3), prevFrom: subMonths(now, 6) };
  if (period === "1y") return { from: subMonths(now, 12), prevFrom: subMonths(now, 24) };
  return { from: null, prevFrom: null };
}

async function completedIn(db: Db, from: Date | null, to: Date) {
  return db.readingRecord.findMany({
    where: { status: "COMPLETED", finishedAt: { not: null, ...(from ? { gte: from } : {}), lt: to } },
    select: {
      startedAt: true,
      finishedAt: true,
      rating: true,
      book: {
        select: {
          id: true,
          title: true,
          genre: true,
          pageCount: true,
          publishedYear: true,
          authors: { select: { author: { select: { id: true, name: true } } } },
          tags: { select: { tag: { select: { name: true } } } },
        },
      },
    },
  });
}

function countBy<T>(items: T[], key: (t: T) => string | string[] | null | undefined) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    for (const v of Array.isArray(k) ? k : k ? [k] : []) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export async function analyzeTrends(db: Db, period: InsightPeriod, now = new Date()) {
  const { from, prevFrom } = rangeOf(period, now);
  const [records, prev, quotes, addedBooks] = await Promise.all([
    completedIn(db, from, new Date(now.getTime() + 1)),
    from && prevFrom ? completedIn(db, prevFrom, from) : Promise.resolve([]),
    db.quote.findMany({ where: from ? { createdAt: { gte: from } } : {}, select: { tags: { select: { tag: { select: { name: true } } } }, bookId: true } }),
    db.book.findMany({ where: from ? { createdAt: { gte: from } } : {}, select: { genre: true, tags: { select: { tag: { select: { name: true } } } } } }),
  ]);

  const genres = countBy(records, (r) => r.book.genre ?? "未分類");
  const authors = countBy(records, (r) => r.book.authors.map((a) => a.author.name));
  const tags = countBy(records, (r) => r.book.tags.map((t) => t.tag.name));
  const quoteTags = countBy(quotes, (q) => q.tags.map((t) => t.tag.name));
  const addedGenres = countBy(addedBooks, (b) => b.genre ?? null);
  const eras = countBy(records, (r) => (r.book.publishedYear ? (r.book.publishedYear < 1900 ? "1900年より前" : `${Math.floor(r.book.publishedYear / 10) * 10}年代`) : null));
  const rated = records.filter((r) => r.rating != null);
  const paged = records.filter((r) => r.book.pageCount);
  const durations = records.filter((r) => r.startedAt && r.finishedAt).map((r) => Math.max(1, differenceInCalendarDays(r.finishedAt!, r.startedAt!) + 1));

  // 前の同じ長さの期間と比べて増えた／減ったジャンル
  const prevGenres = new Map(countBy(prev, (r) => r.book.genre ?? "未分類").map((g) => [g.name, g.count]));
  const curGenres = new Map(genres.map((g) => [g.name, g.count]));
  const names = new Set([...prevGenres.keys(), ...curGenres.keys()]);
  const changes = [...names].map((n) => ({ name: n, now: curGenres.get(n) ?? 0, before: prevGenres.get(n) ?? 0, diff: (curGenres.get(n) ?? 0) - (prevGenres.get(n) ?? 0) }));
  const increased = changes.filter((c) => c.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 5);
  const decreased = changes.filter((c) => c.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 5);

  const observations: string[] = [];
  const label = INSIGHT_PERIOD_LABEL[period];
  if (!records.length) {
    observations.push(`${period === "all" ? "" : `直近${label}に`}読了した本はまだ記録されていません。`);
  } else {
    observations.push(`${period === "all" ? "これまでに" : `直近${label}で`}${records.length}冊を読了しています。`);
    if (genres[0] && genres[0].name !== "未分類") {
      const share = Math.round((genres[0].count / records.length) * 100);
      observations.push(`読了した本のうち「${genres[0].name}」が${genres[0].count}冊（約${share}%）で最も多くなっています。`);
    }
    if (increased[0] && period !== "all") observations.push(`前の${label}と比べると、「${increased[0].name}」の本が${increased[0].diff}冊増えています。`);
    if (decreased[0] && period !== "all") observations.push(`一方で「${decreased[0].name}」は${-decreased[0].diff}冊減っています。`);
    if (authors[0] && authors[0].count >= 2) observations.push(`${authors[0].name}の本を${authors[0].count}冊読んでいます。`);
    if (rated.length >= 3) {
      const avg = rated.reduce((s, r) => s + r.rating!, 0) / rated.length;
      const top = countBy(rated.filter((r) => r.rating! >= 4), (r) => r.book.genre ?? null)[0];
      observations.push(`平均評価は★${avg.toFixed(1)}です${top ? `。高評価（★4以上）の本は「${top.name}」に多く見られます` : ""}。`);
    }
  }
  if (quoteTags[0]) observations.push(`保存したフレーズでは「#${quoteTags[0].name}」のタグが${quoteTags[0].count}件と最も多く付いています。`);
  if (addedGenres[0] && period !== "all") observations.push(`この期間に新しく登録した本では「${addedGenres[0].name}」が多くなっています。`);

  return {
    period,
    total: records.length,
    genres,
    authors: authors.slice(0, 8),
    tags: tags.slice(0, 12),
    quoteTags: quoteTags.slice(0, 12),
    eras: eras.sort((a, b) => a.name.localeCompare(b.name)),
    avgRating: rated.length ? rated.reduce((s, r) => s + r.rating!, 0) / rated.length : null,
    avgPages: paged.length ? paged.reduce((s, r) => s + (r.book.pageCount ?? 0), 0) / paged.length : null,
    avgDays: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    increased,
    decreased,
    observations,
  };
}

export type TrendAnalysis = Awaited<ReturnType<typeof analyzeTrends>>;

/** まだ読んでいない分野（登録済みジャンルとの比較） */
export async function unexploredGenres(db: Db, allGenres: string[]) {
  const rows = await db.book.groupBy({ by: ["genre"], where: { status: "COMPLETED" }, _count: { _all: true } });
  const read = new Set(rows.map((r) => r.genre).filter(Boolean));
  return allGenres.filter((g) => !read.has(g));
}

export async function lifeSummary(db: Db) {
  const [completed, pages, quotes, knowledge, books, firstRecord, top] = await Promise.all([
    db.readingRecord.count({ where: { status: "COMPLETED" } }),
    db.readingSession.aggregate({ _sum: { pagesRead: true, minutes: true } }),
    db.quote.count(),
    db.knowledgeNote.count(),
    db.book.count(),
    db.readingRecord.findFirst({ where: { OR: [{ startedAt: { not: null } }, { finishedAt: { not: null } }] }, orderBy: [{ startedAt: "asc" }], select: { startedAt: true, finishedAt: true } }),
    analyzeTrends(db, "all"),
  ]);
  const [longest, best] = await Promise.all([
    db.book.findFirst({ where: { status: "COMPLETED", pageCount: { not: null } }, orderBy: { pageCount: "desc" }, select: { id: true, title: true, pageCount: true } }),
    db.book.findMany({ where: { rating: 5 }, orderBy: { finishedAt: "desc" }, select: { id: true, title: true, coverImage: true }, take: 6 }),
  ]);
  return {
    completed,
    pages: await pagesInRange(db, null, new Date()),
    minutes: pages._sum.minutes ?? 0,
    quotes,
    knowledge,
    books,
    since: firstRecord?.startedAt ?? firstRecord?.finishedAt ?? null,
    topGenre: top.genres.find((g) => g.name !== "未分類") ?? null,
    topAuthor: top.authors[0] ?? null,
    longest,
    best,
  };
}
