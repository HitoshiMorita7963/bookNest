/**
 * ニュース（ホームの「本日のニュース」）。
 * ホームを開いたときに前回から3時間以上たっていれば（または更新ボタンで）、RSS から見出しとリンクだけを集める（本文は保存しない）。
 *  - 主要：Yahoo!ニュースの主要・経済トピックス
 *  - 知識に関係：登録済みの知識のタイトルを回ごとに入れ替えて選び、Googleニュースで検索する（設定でオフにできる）
 * 保存したニュースは知識につなげられる。保存しなかったものは数日で消える。
 */
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { createKnowledge } from "./knowledge";
import { getSettings, updateSettings } from "./settings";

export const NEWS_TOP_COUNT = 5;
export const NEWS_KNOWLEDGE_COUNT = 5;
/** ニュースで追う知識を選んでいるときの主要ニュースの数（残りは追う知識に関係するニュース） */
export const NEWS_TOP_WITH_INTERESTS = 3;
/** 保存しなかったニュースを残す日数 */
export const NEWS_KEEP_DAYS = 3;

const TOP_FEEDS = [
  { url: "https://news.yahoo.co.jp/rss/topics/top-picks.xml", feed: "top", source: "Yahoo!ニュース" },
  { url: "https://news.yahoo.co.jp/rss/topics/business.xml", feed: "business", source: "Yahoo!ニュース" },
] as const;
/** Googleニュースの検索（days 日以内の記事） */
const googleSearchUrl = (q: string, days = 2) => `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:${days}d`)}&hl=ja&gl=JP&ceid=JP:ja`;

export type Fetcher = (url: string) => Promise<string | null>;

/** RSS を取得する（失敗・時間切れは null） */
export const fetchRss: Fetcher = async (url) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "BookNest/1.0" }, redirect: "follow" });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
};

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDay(d = new Date()): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}
const tag = (item: string, name: string) => {
  const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
};

export interface RssItem {
  title: string;
  url: string;
  source: string;
  publishedAt: Date | null;
}

/** RSS 2.0 の item を読む。Googleニュースの「見出し - 配信元」は見出しと配信元に分ける */
export function parseRss(xml: string, defaultSource = ""): RssItem[] {
  return xml
    .split(/<item[\s>]/)
    .slice(1)
    .map((raw) => {
      const item = raw.split("</item>")[0];
      const source = tag(item, "source") || defaultSource;
      let title = tag(item, "title");
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(` - ${source}`.length));
      const date = tag(item, "pubDate");
      const publishedAt = date ? new Date(date) : null;
      return { title, url: tag(item, "link"), source, publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null };
    })
    .filter((i) => i.title && /^https?:\/\//.test(i.url));
}

/**
 * 知識のタイトルから、ニュースの検索・照合に使う言葉。
 * 例：「AI(海外)」→ AI、「書店・取次」→ 書店・取次。長すぎる・短すぎるものは使わない。
 */
export function knowledgeKeywords(title: string): string[] {
  return title
    .replace(/[（(][^)）]*[)）]/g, "")
    .replace(/[「」『』]/g, "")
    .split(/[・／/]/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 2 && k.length <= 15 && !(/\s/.test(k) && k.length > 10));
}

/** 見出しにその言葉が含まれるか（英字だけの短い言葉は単語の区切りで判定：「AI」が「AIR」に一致しないように） */
export function titleHasKeyword(title: string, keyword: string): boolean {
  if (/^[A-Za-z0-9]+$/.test(keyword)) return new RegExp(`(^|[^A-Za-z0-9])${keyword}([^A-Za-z0-9]|$)`, "i").test(title);
  return title.includes(keyword);
}

/** 日によって変わる、決まった順の並べ替え（同じ日なら同じ結果） */
function dailyShuffle<T>(xs: T[], day: string): T[] {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 2 ** 32);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const sameStory = (a: string, b: string) => a === b || a.slice(0, 18) === b.slice(0, 18);

/** 自動で集め直す間隔（時間）。ホームを開いたとき、前回からこれ以上たっていれば集め直す */
export const NEWS_REFRESH_HOURS = 3;
/** 更新ボタンで集め直せる最短の間隔（分）。外部サイトへの問い合わせを続けないため */
export const NEWS_MIN_MANUAL_MINUTES = 5;

/** 最後に集めた回の時刻（fetchedAt の列を追加する前に集めたものは作成日時） */
export async function lastNewsFetch(db: Db): Promise<Date | null> {
  const [withTime, legacy] = await Promise.all([
    db.newsItem.findFirst({ where: { fetchedAt: { not: null } }, orderBy: { fetchedAt: "desc" }, select: { fetchedAt: true } }),
    db.newsItem.findFirst({ where: { fetchedAt: null }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const times = [withTime?.fetchedAt, legacy?.createdAt].filter((d): d is Date => !!d);
  return times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : null;
}

export type RefreshResult = { refreshed: true } | { refreshed: false; reason: "fresh" | "too-soon" | "failed" };

/**
 * ニュースを集める。
 * - 通常（ホームを開いたとき）：前回から NEWS_REFRESH_HOURS 時間以上たっていれば集め直す
 * - force（更新ボタン）：前回から NEWS_MIN_MANUAL_MINUTES 分以上たっていれば集め直す
 * 同じ回に集めたニュースには同じ fetchedAt を付け、ホームには最新の回のものを並べる。
 * 前の回と同じ記事は、新しい回のものとして付け直す（URL は一意なので重複しない）。
 */
export async function refreshNews(db: Db, opts: { fetcher?: Fetcher; now?: Date; force?: boolean } = {}): Promise<RefreshResult> {
  const fetcher = opts.fetcher ?? fetchRss;
  const now = opts.now ?? new Date();
  const last = await lastNewsFetch(db);
  const age = last ? now.getTime() - last.getTime() : Infinity;
  if (!opts.force && age < NEWS_REFRESH_HOURS * 3600_000) return { refreshed: false, reason: "fresh" };
  if (opts.force && age < NEWS_MIN_MANUAL_MINUTES * 60_000) return { refreshed: false, reason: "too-soon" };
  const day = jstDay(now);

  // 古い未保存のニュースを消す
  const keepFrom = new Date(now.getTime() - NEWS_KEEP_DAYS * 86400_000);
  await db.newsItem.deleteMany({ where: { savedAt: null, OR: [{ fetchedAt: { lt: keepFrom } }, { fetchedAt: null, createdAt: { lt: keepFrom } }] } });

  const notes = await db.knowledgeNote.findMany({ select: { title: true, updatedAt: true }, orderBy: { updatedAt: "desc" } });
  const keywords = [...new Set(notes.flatMap((n) => knowledgeKeywords(n.title)))];
  const findKeyword = (title: string) => keywords.filter((k) => titleHasKeyword(title, k)).sort((a, b) => b.length - a.length)[0] ?? null;

  const picked: (RssItem & { feed: string; keyword: string | null })[] = [];
  const add = (it: RssItem, feed: string, keyword: string | null) => {
    if (picked.some((p) => p.url === it.url || sameStory(p.title, it.title))) return false;
    picked.push({ ...it, feed, keyword });
    return true;
  };

  // ニュースで追う知識（選んでいれば、その知識に関係するニュースを中心に集める）
  const settings = await getSettings(db);
  const interestNotes =
    settings.newsKnowledgeSearch && settings.newsInterestIds.length
      ? await db.knowledgeNote.findMany({ where: { id: { in: settings.newsInterestIds } }, select: { title: true } })
      : [];
  const interestKeywords = [...new Set(interestNotes.flatMap((n) => knowledgeKeywords(n.title)))];
  const isInterest = (k: string) => interestKeywords.includes(k);
  const topCount = interestKeywords.length ? NEWS_TOP_WITH_INTERESTS : NEWS_TOP_COUNT;
  const relatedCount = NEWS_TOP_COUNT + NEWS_KNOWLEDGE_COUNT - topCount;

  // 主要ニュース：主要と経済から交互に
  const tops = await Promise.all(TOP_FEEDS.map(async (f) => ({ f, items: parseRss((await fetcher(f.url)) ?? "", f.source) })));
  for (let i = 0, n = 0; n < topCount && i < 20; i++) {
    for (const { f, items } of tops) {
      if (n < topCount && items[i] && add(items[i], f.feed, findKeyword(items[i].title))) n++;
    }
  }

  // 知識に関係するニュース：追う知識（なければ、最近さわった知識と回ごとに入れ替わる知識）から言葉を選んで検索
  if (settings.newsKnowledgeSearch && keywords.length) {
    const seed = `${day}-${Math.floor(now.getTime() / (NEWS_REFRESH_HOURS * 3600_000))}`;
    let chosen: string[];
    if (interestKeywords.length) {
      const fromInterest = dailyShuffle(interestKeywords, seed).slice(0, 8);
      // 追う知識が少ないときは、ほかの知識の言葉も少し足す（7件に届かないことを防ぐ）
      const fill = fromInterest.length < 4 ? dailyShuffle(keywords.filter((k) => !isInterest(k)), seed).slice(0, 6 - fromInterest.length) : [];
      chosen = [...fromInterest, ...fill];
    } else {
      const recent = keywords.slice(0, 20);
      chosen = [...new Set([...dailyShuffle(recent, seed).slice(0, 3), ...dailyShuffle(keywords, seed).slice(0, 6)])].slice(0, 8);
    }
    // 4語ずつ検索する。追う知識は記事が少ないこともあるので7日以内、それ以外は2日以内
    const chunk = (ks: string[]) => [ks.slice(0, 4), ks.slice(4, 8)].filter((g) => g.length);
    const groups = [...chunk(chosen.filter(isInterest)).map((g) => ({ g, days: 7 })), ...chunk(chosen.filter((k) => !isInterest(k))).map((g) => ({ g, days: 2 }))].slice(0, 3);
    const results = await Promise.all(groups.map(async ({ g, days }) => parseRss((await fetcher(googleSearchUrl(g.map((k) => `"${k}"`).join(" OR "), days))) ?? "")));
    const candidates = results
      .flat()
      .map((it) => ({ it, keyword: chosen.filter((k) => titleHasKeyword(it.title, k)).sort((a, b) => b.length - a.length)[0] ?? null }))
      .filter((c): c is { it: RssItem; keyword: string } => !!c.keyword)
      // 追う知識のニュースを先に、その中では新しい順
      .sort((a, b) => Number(isInterest(b.keyword)) - Number(isInterest(a.keyword)) || (b.it.publishedAt?.getTime() ?? 0) - (a.it.publishedAt?.getTime() ?? 0));
    // 1回目は1つの言葉につき1件（いろいろな話題を並べる）。足りなければ、追う知識の言葉は何件でも
    const used = new Map<string, number>();
    let n = 0;
    for (const limit of [1, relatedCount]) {
      for (const c of candidates) {
        if (n >= relatedCount) break;
        if ((used.get(c.keyword) ?? 0) >= limit || (limit > 1 && !isInterest(c.keyword))) continue;
        if (add(c.it, isInterest(c.keyword) ? "interest" : "knowledge", c.keyword)) {
          used.set(c.keyword, (used.get(c.keyword) ?? 0) + 1);
          n++;
        }
      }
    }
  }

  // 知識に関係するニュースが足りなければ、主要ニュースで埋めて合計を保つ
  const total = NEWS_TOP_COUNT + NEWS_KNOWLEDGE_COUNT;
  for (let i = 0; picked.length < total && i < 20; i++) {
    for (const { f, items } of tops) {
      if (picked.length < total && items[i]) add(items[i], f.feed, findKeyword(items[i].title));
    }
  }

  // 1件も集められなかったときは何も変えず、前の回をそのまま見せる（次に開いたときにやり直す）
  if (!picked.length) return { refreshed: false, reason: "failed" };
  for (const it of picked) {
    await db.newsItem.upsert({
      where: { url: it.url },
      create: { title: it.title.slice(0, 300), url: it.url.slice(0, 2000), source: it.source.slice(0, 100), feed: it.feed, publishedAt: it.publishedAt, day, keyword: it.keyword, fetchedAt: now },
      update: { fetchedAt: now, day, feed: it.feed, keyword: it.keyword },
    });
  }
  return { refreshed: true };
}

const newsInclude = { knowledge: { include: { knowledge: { select: { id: true, title: true } } }, orderBy: { createdAt: "asc" as const } } };

/** 見出しの言葉に合う知識（候補）を付ける */
async function withCandidates<T extends { keyword: string | null; knowledge: { knowledge: { id: string } }[] }>(db: Db, items: T[]) {
  const words = [...new Set(items.map((i) => i.keyword).filter((k): k is string => !!k))];
  const notes = words.length ? await db.knowledgeNote.findMany({ where: { OR: words.map((w) => ({ title: { contains: w } })) }, select: { id: true, title: true } }) : [];
  return items.map((i) => ({
    ...i,
    candidates: i.keyword
      ? notes.filter((n) => knowledgeKeywords(n.title).includes(i.keyword!) && !i.knowledge.some((l) => l.knowledge.id === n.id)).slice(0, 3)
      : [],
  }));
}

/** 最新の回に集めたニュース（主要 → 知識に関係 の順）と、その時刻 */
export async function listLatestNews(db: Db) {
  const fetchedAt = await lastNewsFetch(db);
  if (!fetchedAt) return { fetchedAt: null, items: [] };
  const items = await db.newsItem.findMany({
    // fetchedAt の列を追加する前に集めたものは、作成日時が近いものを同じ回とみなす
    where: { OR: [{ fetchedAt }, { fetchedAt: null, createdAt: { gte: new Date(fetchedAt.getTime() - 5 * 60_000) } }] },
    include: newsInclude,
    orderBy: [{ createdAt: "asc" }],
  });
  // 追う知識 → 主要・経済 → 知識に関係 の順
  const order = (f: string) => (f === "interest" ? 0 : f === "knowledge" ? 2 : 1);
  return { fetchedAt, items: await withCandidates(db, items.sort((a, b) => order(a.feed) - order(b.feed))) };
}
export type LatestNewsItem = Awaited<ReturnType<typeof listLatestNews>>["items"][number];

export async function listSavedNews(db: Db, opts: { knowledgeId?: string; take?: number } = {}) {
  const items = await db.newsItem.findMany({
    where: { savedAt: { not: null }, ...(opts.knowledgeId ? { knowledge: { some: { knowledgeId: opts.knowledgeId } } } : {}) },
    include: newsInclude,
    orderBy: { savedAt: "desc" },
    take: opts.take ?? 100,
  });
  return withCandidates(db, items);
}

/** ニュースを保存し、知識につなげる（すでにつながっている知識はそのまま） */
export async function saveNews(db: Db, id: string, input: { knowledgeIds?: string[]; memo?: string } = {}) {
  const news = await db.newsItem.findUnique({ where: { id }, select: { id: true, savedAt: true } });
  if (!news) throw new NotFoundError("ニュース");
  const ids = [...new Set(input.knowledgeIds ?? [])].slice(0, 20);
  if (ids.length && (await db.knowledgeNote.count({ where: { id: { in: ids } } })) !== ids.length) throw new NotFoundError("知識");
  await db.$transaction(async (tx) => {
    await tx.newsItem.update({ where: { id }, data: { savedAt: news.savedAt ?? new Date(), ...(input.memo !== undefined ? { memo: input.memo.trim().slice(0, 2000) } : {}) } });
    for (const knowledgeId of ids) {
      await tx.newsKnowledge.upsert({ where: { newsId_knowledgeId: { newsId: id, knowledgeId } }, create: { newsId: id, knowledgeId }, update: {} });
    }
  });
}

/** 保存をやめる（知識とのつながりも外す。今日の分なら一覧には残る） */
export async function unsaveNews(db: Db, id: string) {
  await db.$transaction([db.newsKnowledge.deleteMany({ where: { newsId: id } }), db.newsItem.updateMany({ where: { id }, data: { savedAt: null } })]);
}

export async function unlinkNewsKnowledge(db: Db, newsId: string, knowledgeId: string) {
  await db.newsKnowledge.deleteMany({ where: { newsId, knowledgeId } });
}

/** ニュースから新しい知識を作り、保存してつなげる */
export async function createKnowledgeFromNews(db: Db, id: string, input: { title: string; content?: string; category?: string | null }) {
  const news = await db.newsItem.findUnique({ where: { id } });
  if (!news) throw new NotFoundError("ニュース");
  const title = input.title.trim();
  if (!title) throw new AppError("知識のタイトルを入力してください", "VALIDATION");
  const content = input.content?.trim() || `${news.title}\n${news.url}${news.source ? `\n（${news.source}）` : ""}`;
  const note = await createKnowledge(db, { title, content, category: input.category || null });
  await saveNews(db, id, { knowledgeIds: [note.id] });
  return note;
}

/* ---------------- ニュースで追う知識 ---------------- */

/** ニュースで追う知識（選んだ順。消えた知識は除く） */
export async function listNewsInterests(db: Db) {
  const { newsInterestIds } = await getSettings(db);
  if (!newsInterestIds.length) return [];
  const notes = await db.knowledgeNote.findMany({ where: { id: { in: newsInterestIds } }, select: { id: true, title: true, category: true } });
  return newsInterestIds.map((id) => notes.find((n) => n.id === id)).filter((n): n is NonNullable<typeof n> => !!n);
}

/** 知識を「ニュースで追う」に入れる・外す */
export async function setNewsInterest(db: Db, knowledgeId: string, on: boolean) {
  const { newsInterestIds } = await getSettings(db);
  if (on) {
    if (!(await db.knowledgeNote.count({ where: { id: knowledgeId } }))) throw new NotFoundError("知識");
    if (newsInterestIds.includes(knowledgeId)) return;
    if (newsInterestIds.length >= 50) throw new AppError("ニュースで追える知識は50件までです", "VALIDATION");
    // 消えた知識の ID はこのときに片付ける
    const alive = new Set((await db.knowledgeNote.findMany({ where: { id: { in: newsInterestIds } }, select: { id: true } })).map((n) => n.id));
    await updateSettings(db, { newsInterestIds: [...newsInterestIds.filter((id) => alive.has(id)), knowledgeId] });
  } else {
    await updateSettings(db, { newsInterestIds: newsInterestIds.filter((id) => id !== knowledgeId) });
  }
}
