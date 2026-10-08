/**
 * 本日のニュース。
 * 1日1回（その日はじめてホームを開いたとき）、RSS から見出しとリンクだけを集める（本文は保存しない）。
 *  - 主要：Yahoo!ニュースの主要・経済トピックス
 *  - 知識に関係：登録済みの知識のタイトルを日替わりで選び、Googleニュースで検索する（設定でオフにできる）
 * 保存したニュースは知識につなげられる。保存しなかったものは数日で消える。
 */
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { createKnowledge } from "./knowledge";
import { getSettings } from "./settings";

export const NEWS_TOP_COUNT = 5;
export const NEWS_KNOWLEDGE_COUNT = 5;
/** 保存しなかったニュースを残す日数 */
export const NEWS_KEEP_DAYS = 3;

const TOP_FEEDS = [
  { url: "https://news.yahoo.co.jp/rss/topics/top-picks.xml", feed: "top", source: "Yahoo!ニュース" },
  { url: "https://news.yahoo.co.jp/rss/topics/business.xml", feed: "business", source: "Yahoo!ニュース" },
] as const;
const googleSearchUrl = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:2d`)}&hl=ja&gl=JP&ceid=JP:ja`;

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

/**
 * 今日のニュースがまだなければ集める。集めたら true。
 * 同じ日に何度呼んでも、2回目以降は何もしない（URL は一意なので、同時に呼ばれても重複しない）。
 */
export async function ensureTodayNews(db: Db, opts: { fetcher?: Fetcher; now?: Date } = {}): Promise<boolean> {
  const fetcher = opts.fetcher ?? fetchRss;
  const day = jstDay(opts.now);
  if (await db.newsItem.count({ where: { day } })) return false;

  // 古い未保存のニュースを消す
  const keepFrom = jstDay(new Date((opts.now ?? new Date()).getTime() - NEWS_KEEP_DAYS * 86400_000));
  await db.newsItem.deleteMany({ where: { savedAt: null, day: { lt: keepFrom } } });

  const notes = await db.knowledgeNote.findMany({ select: { title: true, updatedAt: true }, orderBy: { updatedAt: "desc" } });
  const keywords = [...new Set(notes.flatMap((n) => knowledgeKeywords(n.title)))];
  const findKeyword = (title: string) => keywords.filter((k) => titleHasKeyword(title, k)).sort((a, b) => b.length - a.length)[0] ?? null;

  const picked: (RssItem & { feed: string; keyword: string | null })[] = [];
  const add = (it: RssItem, feed: string, keyword: string | null) => {
    if (picked.some((p) => p.url === it.url || sameStory(p.title, it.title))) return false;
    picked.push({ ...it, feed, keyword });
    return true;
  };

  // 主要ニュース：主要と経済から交互に
  const tops = await Promise.all(TOP_FEEDS.map(async (f) => ({ f, items: parseRss((await fetcher(f.url)) ?? "", f.source) })));
  for (let i = 0, n = 0; n < NEWS_TOP_COUNT && i < 20; i++) {
    for (const { f, items } of tops) {
      if (n < NEWS_TOP_COUNT && items[i] && add(items[i], f.feed, findKeyword(items[i].title))) n++;
    }
  }

  // 知識に関係するニュース：最近さわった知識と、日替わりの知識から言葉を選んで検索
  const { newsKnowledgeSearch } = await getSettings(db);
  if (newsKnowledgeSearch && keywords.length) {
    const recent = keywords.slice(0, 20);
    const chosen = [...new Set([...dailyShuffle(recent, day).slice(0, 3), ...dailyShuffle(keywords, day).slice(0, 6)])].slice(0, 8);
    const groups = [chosen.slice(0, 4), chosen.slice(4, 8)].filter((g) => g.length);
    const results = await Promise.all(groups.map(async (g) => parseRss((await fetcher(googleSearchUrl(g.map((k) => `"${k}"`).join(" OR ")))) ?? "")));
    const candidates = results
      .flat()
      .map((it) => ({ it, keyword: chosen.filter((k) => titleHasKeyword(it.title, k)).sort((a, b) => b.length - a.length)[0] ?? null }))
      .filter((c): c is { it: RssItem; keyword: string } => !!c.keyword)
      .sort((a, b) => (b.it.publishedAt?.getTime() ?? 0) - (a.it.publishedAt?.getTime() ?? 0));
    // 同じ言葉のニュースが並ばないよう、まず1つの言葉につき1件
    const usedKeywords = new Set<string>();
    let n = 0;
    for (const c of candidates) {
      if (n >= NEWS_KNOWLEDGE_COUNT || usedKeywords.has(c.keyword)) continue;
      if (add(c.it, "knowledge", c.keyword)) {
        usedKeywords.add(c.keyword);
        n++;
      }
    }
  }

  for (const it of picked) {
    await db.newsItem.upsert({
      where: { url: it.url },
      create: { title: it.title.slice(0, 300), url: it.url.slice(0, 2000), source: it.source.slice(0, 100), feed: it.feed, publishedAt: it.publishedAt, day, keyword: it.keyword },
      update: {},
    });
  }
  return picked.length > 0;
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

/** 今日のニュース（主要 → 知識に関係 の順） */
export async function listTodayNews(db: Db, now?: Date) {
  const items = await db.newsItem.findMany({ where: { day: jstDay(now) }, include: newsInclude, orderBy: [{ createdAt: "asc" }] });
  const order = (f: string) => (f === "knowledge" ? 1 : 0);
  return withCandidates(db, items.sort((a, b) => order(a.feed) - order(b.feed)));
}
export type TodayNewsItem = Awaited<ReturnType<typeof listTodayNews>>[number];

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
