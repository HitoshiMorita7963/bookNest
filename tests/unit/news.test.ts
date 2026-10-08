import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createKnowledge } from "@/server/services/knowledge";
import { updateSettings } from "@/server/services/settings";
import {
  createKnowledgeFromNews,
  jstDay,
  knowledgeKeywords,
  listSavedNews,
  listLatestNews,
  parseRss,
  refreshNews,
  setNewsInterest,
  listNewsInterests,
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

const HOUR = 3600_000;
const latest = async () => (await listLatestNews(db)).items;

describe("latest news", () => {
  it("collects top news and knowledge-related news, with candidate knowledge, and does not refetch while fresh", async () => {
    await createKnowledge(db, { title: "データセンター", content: "" });
    await createKnowledge(db, { title: "書店・取次", content: "" });
    await createKnowledge(db, { title: "ラピダス", content: "" });
    await createKnowledge(db, { title: "AI(海外)", content: "" });
    const calls: string[] = [];
    expect(await refreshNews(db, { fetcher: fakeFetcher(calls), now: NOW })).toEqual({ refreshed: true });
    // 3時間たつまでは、開いても集め直さない
    expect(await refreshNews(db, { fetcher: fakeFetcher(calls), now: new Date(NOW.getTime() + 2 * HOUR) })).toEqual({ refreshed: false, reason: "fresh" });
    expect(calls.filter((c) => c.includes("yahoo")).length).toBe(2);

    const { fetchedAt, items } = await listLatestNews(db);
    expect(fetchedAt).toEqual(NOW);
    const top = items.filter((n) => n.feed !== "knowledge");
    // 主要と経済から交互に、同じ記事は1回だけ
    expect(top.map((n) => n.title)).toEqual(["首相が会見 経済対策を発表", "日銀が利上げを決定", "台風が接近 交通に影響", "データセンター誘致で地方に投資", "半導体大手が増益"]);
    // 見出しに知識の名前があれば候補として出す
    expect(top.find((n) => n.title.startsWith("データセンター"))?.candidates.map((c) => c.title)).toEqual(["データセンター"]);
    const related = items.filter((n) => n.feed === "knowledge");
    expect(related.map((n) => [n.title, n.source, n.keyword])).toEqual([
      ["ラピダスが試作ラインを公開", "日本経済新聞", "ラピダス"],
      ["書店の閉店相次ぐ", "地方紙", "書店"],
    ]);
  });

  it("refreshes automatically after 3 hours and with the button (not within 5 minutes), showing only the latest batch", async () => {
    let round = 0;
    // 回ごとに1件だけ新しい記事が出る
    const fetcher: Fetcher = async (url) =>
      url.includes("top-picks")
        ? rss([
            { title: "ずっと出ている記事", link: "https://n/always" },
            { title: `第${round}回の新しい記事`, link: `https://n/new-${round}` },
          ])
        : null;
    await refreshNews(db, { fetcher, now: NOW });
    expect((await latest()).map((n) => n.title)).toEqual(["ずっと出ている記事", "第0回の新しい記事"]);

    // 更新ボタン：5分以内は集め直さない
    round = 1;
    expect(await refreshNews(db, { fetcher, now: new Date(NOW.getTime() + 3 * 60_000), force: true })).toEqual({ refreshed: false, reason: "too-soon" });
    // 10分後なら集め直す。前の回の記事は最新の一覧から外れ、続けて出ている記事は残る
    const t1 = new Date(NOW.getTime() + 10 * 60_000);
    expect(await refreshNews(db, { fetcher, now: t1, force: true })).toEqual({ refreshed: true });
    expect((await listLatestNews(db)).fetchedAt).toEqual(t1);
    expect((await latest()).map((n) => n.title)).toEqual(["ずっと出ている記事", "第1回の新しい記事"]);

    // 3時間後に開くと自動で集め直す
    round = 2;
    const t2 = new Date(t1.getTime() + 3 * HOUR);
    expect(await refreshNews(db, { fetcher, now: t2 })).toEqual({ refreshed: true });
    expect((await latest()).map((n) => n.title)).toEqual(["ずっと出ている記事", "第2回の新しい記事"]);
    // 同じ記事は重複しない
    expect(await db.newsItem.count({ where: { url: "https://n/always" } })).toBe(1);

    // 取得に失敗したときは、前の回をそのまま見せる
    expect(await refreshNews(db, { fetcher: async () => null, now: new Date(t2.getTime() + 4 * HOUR) })).toEqual({ refreshed: false, reason: "failed" });
    expect((await latest()).map((n) => n.title)).toEqual(["ずっと出ている記事", "第2回の新しい記事"]);
  });

  it("treats news collected before the fetchedAt column existed as the latest batch", async () => {
    await db.newsItem.create({ data: { title: "列を追加する前の記事", url: "https://n/legacy", day: jstDay(NOW), feed: "top" } });
    const { fetchedAt, items } = await listLatestNews(db);
    expect(fetchedAt).not.toBeNull();
    expect(items.map((n) => n.title)).toEqual(["列を追加する前の記事"]);
    // 3時間たっていなければ集め直さない
    expect(await refreshNews(db, { fetcher: fakeFetcher(), now: new Date(fetchedAt!.getTime() + HOUR) })).toEqual({ refreshed: false, reason: "fresh" });
  });

  it("does not search with knowledge titles when the setting is off, and survives failed feeds", async () => {
    await createKnowledge(db, { title: "ラピダス", content: "" });
    await updateSettings(db, { newsKnowledgeSearch: false });
    const calls: string[] = [];
    await refreshNews(db, { fetcher: fakeFetcher(calls), now: NOW });
    expect(calls.some((c) => c.includes("google"))).toBe(false);
    // すべて失敗したら何も作らず、次に開いたときにやり直す
    await resetDb();
    expect(await refreshNews(db, { fetcher: async () => null, now: NOW })).toEqual({ refreshed: false, reason: "failed" });
    expect(await db.newsItem.count()).toBe(0);
  });

  it("saves news, links it to knowledge, creates knowledge from it, and drops old unsaved news", async () => {
    const dc = await createKnowledge(db, { title: "データセンター", content: "" });
    await refreshNews(db, { fetcher: fakeFetcher(), now: NOW });
    const [first, second] = await latest();
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
    await refreshNews(db, { fetcher: async () => null, now: later });
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
    await refreshNews(db, { fetcher: fakeFetcher(), now: NOW });
    const [first] = await latest();
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

describe("knowledge to follow in the news", () => {
  it("puts news about followed knowledge first (3 top + up to 7 related), filling with other knowledge", async () => {
    const rapidus = await createKnowledge(db, { title: "ラピダス", content: "" });
    await createKnowledge(db, { title: "書店・取次", content: "" });
    await createKnowledge(db, { title: "データセンター", content: "" });
    await setNewsInterest(db, rapidus.id, true);
    await setNewsInterest(db, rapidus.id, true);
    expect((await listNewsInterests(db)).map((k) => k.title)).toEqual(["ラピダス"]);

    const calls: string[] = [];
    await refreshNews(db, { fetcher: fakeFetcher(calls), now: NOW });
    const items = await latest();
    // 追う知識のニュースが先頭に「interest」として並ぶ
    expect(items[0]).toMatchObject({ title: "ラピダスが試作ラインを公開", feed: "interest", keyword: "ラピダス" });
    // 追う知識が少ないので、ほかの知識のニュースでも埋める
    expect(items.filter((n) => n.feed === "knowledge").map((n) => n.keyword)).toEqual(["書店"]);
    // それでも足りない分は主要ニュースで埋める（この例では主要が5件しかないので合計7件）
    expect(items.filter((n) => n.feed === "top" || n.feed === "business")).toHaveLength(5);
    // 検索語には追う知識が必ず入る
    expect(calls.some((c) => c.includes("news.google.com") && decodeURIComponent(c).includes('"ラピダス"'))).toBe(true);
  });

  it("can fill 7 of 10 with one followed knowledge item when there are enough articles", async () => {
    const rapidus = await createKnowledge(db, { title: "ラピダス", content: "" });
    await setNewsInterest(db, rapidus.id, true);
    const fetcher: Fetcher = async (url) => {
      if (url.includes("news.google.com")) return rss(Array.from({ length: 9 }, (_, i) => ({ title: `ラピダスの話題${i}と別の件${i}`, link: `https://g/${i}` })));
      return (await fakeFetcher()(url));
    };
    const calls: string[] = [];
    await refreshNews(db, { fetcher: async (u) => (calls.push(u), fetcher(u)), now: NOW });
    const items = await latest();
    expect(items.filter((n) => n.feed === "interest")).toHaveLength(7);
    expect(items.filter((n) => n.feed === "top" || n.feed === "business")).toHaveLength(3);
    // 追う知識は7日以内まで探す
    expect(calls.some((c) => decodeURIComponent(c).includes("when:7d"))).toBe(true);
  });

  it("is ignored when searching with knowledge titles is off, and can be removed or disappears with the knowledge", async () => {
    const rapidus = await createKnowledge(db, { title: "ラピダス", content: "" });
    const store = await createKnowledge(db, { title: "書店・取次", content: "" });
    await setNewsInterest(db, rapidus.id, true);
    await setNewsInterest(db, store.id, true);
    await updateSettings(db, { newsKnowledgeSearch: false });
    const calls: string[] = [];
    await refreshNews(db, { fetcher: fakeFetcher(calls), now: NOW });
    expect(calls.some((c) => c.includes("google"))).toBe(false);
    expect((await latest()).filter((n) => n.feed === "top" || n.feed === "business")).toHaveLength(5);

    await setNewsInterest(db, rapidus.id, false);
    expect((await listNewsInterests(db)).map((k) => k.title)).toEqual(["書店・取次"]);
    await db.knowledgeNote.delete({ where: { id: store.id } });
    expect(await listNewsInterests(db)).toEqual([]);
    await expect(setNewsInterest(db, "nope", true)).rejects.toThrow(/知識/);
  });
});
