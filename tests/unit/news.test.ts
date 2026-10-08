import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createKnowledge } from "@/server/services/knowledge";
import { updateSettings } from "@/server/services/settings";
import {
  createKnowledgeFromNews,
  ensureTodayNews,
  jstDay,
  knowledgeKeywords,
  listSavedNews,
  listTodayNews,
  parseRss,
  saveNews,
  titleHasKeyword,
  unsaveNews,
  type Fetcher,
} from "@/server/services/news";

beforeEach(resetDb);

const rss = (items: { title: string; link: string; source?: string; date?: string }[]) =>
  `<?xml version="1.0"?><rss><channel><title>feed</title>${items
    .map((i) => `<item><title>${i.title}</title><link>${i.link}</link>${i.source ? `<source url="https://x">${i.source}</source>` : ""}<pubDate>${i.date ?? "Thu, 08 Oct 2026 01:00:00 GMT"}</pubDate></item>`)
    .join("")}</channel></rss>`;

const NOW = new Date("2026-10-08T03:00:00Z"); // 日本時間 12:00

function fakeFetcher(calls: string[] = []): Fetcher {
  return async (url) => {
    calls.push(url);
    if (url.includes("top-picks")) {
      return rss([
        { title: "首相が会見 経済対策を発表", link: "https://news.yahoo.co.jp/pickup/1" },
        { title: "台風が接近 交通に影響", link: "https://news.yahoo.co.jp/pickup/2" },
        { title: "データセンター誘致で地方に投資", link: "https://news.yahoo.co.jp/pickup/3" },
      ]);
    }
    if (url.includes("business")) {
      return rss([
        { title: "日銀が利上げを決定", link: "https://news.yahoo.co.jp/pickup/4" },
        { title: "首相が会見 経済対策を発表", link: "https://news.yahoo.co.jp/pickup/1" },
        { title: "半導体大手が増益", link: "https://news.yahoo.co.jp/pickup/5" },
      ]);
    }
    if (url.includes("news.google.com")) {
      return rss([
        { title: "ラピダスが試作ラインを公開 - 日本経済新聞", link: "https://news.google.com/a1", source: "日本経済新聞", date: "Thu, 08 Oct 2026 02:00:00 GMT" },
        { title: "AIRロボの新製品 - 某紙", link: "https://news.google.com/a2", source: "某紙" },
        { title: "書店の閉店相次ぐ - 地方紙", link: "https://news.google.com/a3", source: "地方紙" },
      ]);
    }
    return null;
  };
}

describe("news helpers", () => {
  it("parses RSS, separating the source from Google News titles", () => {
    const items = parseRss(rss([{ title: "見出し &amp; 記事 - 日本経済新聞", link: "https://n/1", source: "日本経済新聞" }, { title: "リンクなし", link: "" }]));
    expect(items).toEqual([{ title: "見出し & 記事", url: "https://n/1", source: "日本経済新聞", publishedAt: new Date("Thu, 08 Oct 2026 01:00:00 GMT") }]);
  });

  it("derives search keywords from knowledge titles and matches them safely", () => {
    expect(knowledgeKeywords("AI(海外)")).toEqual(["AI"]);
    expect(knowledgeKeywords("書店・取次")).toEqual(["書店", "取次"]);
    expect(knowledgeKeywords("X")).toEqual([]);
    expect(titleHasKeyword("生成AIの投資", "AI")).toBe(true);
    expect(titleHasKeyword("AIRロボの新製品", "AI")).toBe(false);
    expect(jstDay(new Date("2026-10-07T16:00:00Z"))).toBe("2026-10-08");
  });
});

describe("today's news", () => {
  it("collects top news and knowledge-related news once a day, with candidate knowledge", async () => {
    await createKnowledge(db, { title: "データセンター", content: "" });
    await createKnowledge(db, { title: "書店・取次", content: "" });
    await createKnowledge(db, { title: "ラピダス", content: "" });
    await createKnowledge(db, { title: "AI(海外)", content: "" });
    const calls: string[] = [];
    expect(await ensureTodayNews(db, { fetcher: fakeFetcher(calls), now: NOW })).toBe(true);
    // 2回目は集めない
    expect(await ensureTodayNews(db, { fetcher: fakeFetcher(calls), now: NOW })).toBe(false);
    expect(calls.filter((c) => c.includes("yahoo")).length).toBe(2);

    const today = await listTodayNews(db, NOW);
    const top = today.filter((n) => n.feed !== "knowledge");
    // 主要と経済から交互に、同じ記事は1回だけ
    expect(top.map((n) => n.title)).toEqual(["首相が会見 経済対策を発表", "日銀が利上げを決定", "台風が接近 交通に影響", "データセンター誘致で地方に投資", "半導体大手が増益"]);
    // 見出しに知識の名前があれば候補として出す
    expect(top.find((n) => n.title.startsWith("データセンター"))?.candidates.map((c) => c.title)).toEqual(["データセンター"]);
    const related = today.filter((n) => n.feed === "knowledge");
    expect(related.map((n) => [n.title, n.source, n.keyword])).toEqual([
      ["ラピダスが試作ラインを公開", "日本経済新聞", "ラピダス"],
      ["書店の閉店相次ぐ", "地方紙", "書店"],
    ]);
  });

  it("does not search with knowledge titles when the setting is off, and survives failed feeds", async () => {
    await createKnowledge(db, { title: "ラピダス", content: "" });
    await updateSettings(db, { newsKnowledgeSearch: false });
    const calls: string[] = [];
    await ensureTodayNews(db, { fetcher: fakeFetcher(calls), now: NOW });
    expect(calls.some((c) => c.includes("google"))).toBe(false);
    // すべて失敗したら何も作らず、次に開いたときにやり直す
    await resetDb();
    expect(await ensureTodayNews(db, { fetcher: async () => null, now: NOW })).toBe(false);
    expect(await db.newsItem.count()).toBe(0);
  });

  it("saves news, links it to knowledge, creates knowledge from it, and drops old unsaved news", async () => {
    const dc = await createKnowledge(db, { title: "データセンター", content: "" });
    await ensureTodayNews(db, { fetcher: fakeFetcher(), now: NOW });
    const [first, second] = await listTodayNews(db, NOW);
    await saveNews(db, first.id, { knowledgeIds: [dc.id], memo: "電力の話" });
    await saveNews(db, first.id, { knowledgeIds: [dc.id] });
    expect(await db.newsKnowledge.count()).toBe(1);
    const note = await createKnowledgeFromNews(db, second.id, { title: "日銀の利上げ" });
    expect(note.content).toContain(second.url);
    const saved = await listSavedNews(db);
    expect(saved.map((s) => s.id).sort()).toEqual([first.id, second.id].sort());
    expect((await listSavedNews(db, { knowledgeId: dc.id })).map((s) => s.memo)).toEqual(["電力の話"]);

    // 4日後：保存したものは残り、保存しなかったものは消える
    const later = new Date(NOW.getTime() + 4 * 86400_000);
    await ensureTodayNews(db, { fetcher: async () => null, now: later });
    const remaining = await db.newsItem.findMany({ where: { day: jstDay(NOW) } });
    expect(remaining.map((r) => r.id).sort()).toEqual([first.id, second.id].sort());

    await unsaveNews(db, first.id);
    expect(await db.newsKnowledge.count({ where: { newsId: first.id } })).toBe(0);
    // 知識を消すと、つながりも消える（ニュースは残る）
    await db.knowledgeNote.delete({ where: { id: note.id } });
    expect(await db.newsItem.count({ where: { id: second.id } })).toBe(1);
  });
});

describe("news in backups", () => {
  it("exports saved news with knowledge links, restores them, and does not duplicate on re-import", async () => {
    const { exportJson, runImport, deleteAllData } = await import("@/server/services/backup");
    const dc = await createKnowledge(db, { title: "データセンター", content: "" });
    await ensureTodayNews(db, { fetcher: fakeFetcher(), now: NOW });
    const [first] = await listTodayNews(db, NOW);
    await saveNews(db, first.id, { knowledgeIds: [dc.id], memo: "電力" });
    const json = JSON.stringify(await exportJson(db));
    const count = await db.newsItem.count();
    await deleteAllData(db);
    expect(await db.newsItem.count()).toBe(0);
    await runImport(db, json);
    expect(await db.newsItem.count()).toBe(count);
    expect(await db.newsKnowledge.count()).toBe(1);
    expect((await listSavedNews(db))[0].memo).toBe("電力");
    await runImport(db, json);
    expect(await db.newsItem.count()).toBe(count);
  });
});
