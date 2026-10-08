import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createKnowledge, linkKnowledge, mergeKnowledge } from "@/server/services/knowledge";
import { createBook } from "@/server/services/books";
import { createQuote } from "@/server/services/quotes";
import { createCreativeKnowledge } from "@/server/services/creative-knowledge";
import { addCkReference } from "@/server/services/creative-knowledge-references";
import { getSettings, updateSettings } from "@/server/services/settings";

beforeEach(resetDb);

describe("merging knowledge", () => {
  it("combines contents and moves tags, books, quotes, links, references, news and news interests without duplicates", async () => {
    const book = await createBook(db, { title: "業界地図" });
    const book2 = await createBook(db, { title: "別の本" });
    const q1 = await createQuote(db, { text: "AIの話1" });
    const q2 = await createQuote(db, { text: "AIの話2" });
    const a = await createKnowledge(db, { title: "AI(海外)", content: "海外の生成AI", category: "注目の業界", tags: ["AI"], bookIds: [book.id], quoteIds: [q1.id] });
    const b = await createKnowledge(db, { title: "AI(国内)", content: "国内の生成AI", category: "情報通信", tags: ["AI", "国内"], bookIds: [book.id, book2.id], quoteIds: [q1.id, q2.id] });
    const empty = await createKnowledge(db, { title: "空の知識", content: "" });
    const other = await createKnowledge(db, { title: "半導体", content: "" });
    const other2 = await createKnowledge(db, { title: "データセンター", content: "" });
    await linkKnowledge(db, a.id, b.id, "海外と国内"); // 統合する知識同士のつながりは消える
    await linkKnowledge(db, b.id, other.id, "計算資源");
    await linkKnowledge(db, other2.id, b.id, null);
    await linkKnowledge(db, a.id, other.id, "既にある"); // 重複しない
    const ck = await createCreativeKnowledge(db, { title: "技術", category: "WORLD" });
    await addCkReference(db, { knowledgeId: ck.id, source: { kind: "knowledgeNote", id: a.id }, comment: "a" });
    await addCkReference(db, { knowledgeId: ck.id, source: { kind: "knowledgeNote", id: b.id }, comment: "b" });
    const news = await db.newsItem.create({ data: { title: "AIニュース", url: "https://n/1", day: "2026-10-08" } });
    await db.newsKnowledge.create({ data: { newsId: news.id, knowledgeId: b.id } });
    await updateSettings(db, { newsInterestIds: [b.id, other.id] });

    const merged = await mergeKnowledge(db, a.id, [b.id, empty.id], { title: "AI（生成AI・海外と国内）" });
    expect(merged.title).toBe("AI（生成AI・海外と国内）");
    expect(merged.category).toBe("注目の業界");
    // 内容は見出しを付けて足す（空の知識は足さない）
    expect(merged.content).toBe("海外の生成AI\n\n――――\n■ AI(国内)\n国内の生成AI");
    expect(await db.knowledgeNote.count({ where: { id: { in: [b.id, empty.id] } } })).toBe(0);

    const tags = await db.knowledgeTag.findMany({ where: { knowledgeId: a.id }, include: { tag: true } });
    expect(tags.map((t) => t.tag.name).sort()).toEqual(["AI", "国内"]);
    expect((await db.bookKnowledge.findMany({ where: { knowledgeId: a.id } })).map((x) => x.bookId).sort()).toEqual([book.id, book2.id].sort());
    expect((await db.quoteKnowledge.findMany({ where: { knowledgeId: a.id } })).map((x) => x.quoteId).sort()).toEqual([q1.id, q2.id].sort());
    const links = await db.knowledgeLink.findMany({ where: { OR: [{ fromId: a.id }, { toId: a.id }] } });
    expect(links.map((l) => [l.fromId === a.id ? l.toId : l.fromId, l.label]).sort()).toEqual([[other.id, "既にある"], [other2.id, null]].sort());
    // 創作知識の参考は同じ相手に1つだけ
    expect(await db.creativeKnowledgeReference.count({ where: { knowledgeId: ck.id } })).toBe(1);
    expect((await db.newsKnowledge.findMany({ where: { newsId: news.id } })).map((n) => n.knowledgeId)).toEqual([a.id]);
    expect((await getSettings(db)).newsInterestIds).toEqual([a.id, other.id]);
  });

  it("can change the category and rejects invalid input", async () => {
    const a = await createKnowledge(db, { title: "鉄鋼(高炉)", content: "高炉", category: "素材" });
    const b = await createKnowledge(db, { title: "鉄鋼(電炉)", content: "電炉", category: "素材" });
    const merged = await mergeKnowledge(db, a.id, [b.id], { title: "鉄鋼（高炉・電炉）", category: "資源・素材" });
    expect(merged.category).toBe("資源・素材");
    await expect(mergeKnowledge(db, a.id, [a.id])).rejects.toThrow(/選んで/);
    await expect(mergeKnowledge(db, a.id, ["nope"])).rejects.toThrow(/知識/);
  });
});
