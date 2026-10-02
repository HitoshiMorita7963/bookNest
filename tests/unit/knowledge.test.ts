import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createBook } from "@/server/services/books";
import { createQuote } from "@/server/services/quotes";
import { createKnowledge, deleteKnowledge, getKnowledge, getKnowledgeGraph, linkKnowledge, linkQuoteKnowledge, listKnowledge, renameKnowledgeCategory, unlinkKnowledge, unlinkQuoteKnowledge, updateKnowledge } from "@/server/services/knowledge";

beforeEach(resetDb);

describe("Knowledge", () => {
  it("creates a note linked to books, quotes and tags", async () => {
    const b1 = await createBook(db, { title: "日本経済入門" });
    const b2 = await createBook(db, { title: "金融政策の教科書" });
    const q = await createQuote(db, { text: "金利は経済の体温計だ", bookId: b2.id });
    const k = await createKnowledge(db, { title: "金融政策", content: "中央銀行が金利を通じて景気を調整する", category: "経済", tags: ["経済"], bookIds: [b1.id, b2.id, "missing"], quoteIds: [q.id] });
    const got = await getKnowledge(db, k.id);
    expect(got?.books.map((b) => b.book.title).sort()).toEqual(["日本経済入門", "金融政策の教科書"].sort());
    expect(got?.quotes[0].quote.text).toBe("金利は経済の体温計だ");
    expect(got?.tags[0].tag.name).toBe("経済");
  });

  it("edits title/content and relations", async () => {
    const b = await createBook(db, { title: "A" });
    const k = await createKnowledge(db, { title: "旧", bookIds: [b.id] });
    await updateKnowledge(db, k.id, { title: "新", content: "本文", bookIds: [] });
    const got = await getKnowledge(db, k.id);
    expect(got?.title).toBe("新");
    expect(got?.content).toBe("本文");
    expect(got?.books).toHaveLength(0);
  });

  it("searches by title, content, tag and related book", async () => {
    const b = await createBook(db, { title: "半導体戦争" });
    await createKnowledge(db, { title: "TSMC", content: "台湾の半導体ファウンドリ", tags: ["地政学"], bookIds: [b.id] });
    await createKnowledge(db, { title: "別の知識" });
    expect(await listKnowledge(db, { q: "TSMC" })).toHaveLength(1);
    expect(await listKnowledge(db, { q: "ファウンドリ" })).toHaveLength(1);
    expect(await listKnowledge(db, { tag: "地政学" })).toHaveLength(1);
    expect(await listKnowledge(db, { q: "半導体戦争" })).toHaveLength(1);
    expect(await listKnowledge(db, { bookId: b.id })).toHaveLength(1);
  });

  it("links knowledge notes for the map and prevents self links", async () => {
    const a = await createKnowledge(db, { title: "半導体" });
    const b = await createKnowledge(db, { title: "AI" });
    await linkKnowledge(db, a.id, b.id, "需要");
    await linkKnowledge(db, b.id, a.id); // 逆向きは既存を返す
    await expect(linkKnowledge(db, a.id, a.id)).rejects.toThrow();
    let g = await getKnowledgeGraph(db);
    expect(g.nodes).toHaveLength(2);
    expect(g.edges.filter((e) => !e.implicit)).toHaveLength(1);
    await unlinkKnowledge(db, b.id, a.id);
    g = await getKnowledgeGraph(db);
    expect(g.edges).toHaveLength(0);
  });

  it("adds implicit edges for notes sharing a book; deleting keeps books", async () => {
    const book = await createBook(db, { title: "共通の本" });
    const a = await createKnowledge(db, { title: "A", bookIds: [book.id] });
    await createKnowledge(db, { title: "B", bookIds: [book.id] });
    const g = await getKnowledgeGraph(db);
    expect(g.edges.filter((e) => e.implicit)).toHaveLength(1);
    await deleteKnowledge(db, a.id);
    expect(await db.book.count()).toBe(1);
  });
});

describe("linking quotes and knowledge later", () => {
  it("links a quote (and its book) to knowledge, and unlinks only the quote", async () => {
    const book = await createBook(db, { title: "あとから本" });
    const q = await createQuote(db, { text: "あとからフレーズ", bookId: book.id });
    const kn = await createKnowledge(db, { title: "あとから知識" });
    await linkQuoteKnowledge(db, q.id, kn.id);
    await linkQuoteKnowledge(db, q.id, kn.id); // 2回目も問題ない
    expect(await db.quoteKnowledge.count({ where: { knowledgeId: kn.id } })).toBe(1);
    expect(await db.bookKnowledge.count({ where: { knowledgeId: kn.id, bookId: book.id } })).toBe(1);
    await unlinkQuoteKnowledge(db, q.id, kn.id);
    expect(await db.quoteKnowledge.count({ where: { knowledgeId: kn.id } })).toBe(0);
    expect(await db.bookKnowledge.count({ where: { knowledgeId: kn.id } })).toBe(1);
    await expect(linkQuoteKnowledge(db, "missing", kn.id)).rejects.toThrow();
  });
});

describe("renaming knowledge categories", () => {
  it("renames, merges into an existing category, and handles uncategorized notes", async () => {
    await createKnowledge(db, { title: "a", category: "経済学" });
    await createKnowledge(db, { title: "b", category: "経済学" });
    await createKnowledge(db, { title: "c", category: "経済" });
    await createKnowledge(db, { title: "d" });

    const merged = await renameKnowledgeCategory(db, "経済学", " 経済 ");
    expect(merged).toMatchObject({ count: 2, merged: true });
    expect(await db.knowledgeNote.count({ where: { category: "経済" } })).toBe(3);
    expect(await db.knowledgeNote.count({ where: { category: "経済学" } })).toBe(0);

    const renamed = await renameKnowledgeCategory(db, "経済", "経済・金融");
    expect(renamed).toMatchObject({ count: 3, merged: false });

    // 未分類の知識にカテゴリを付ける
    await renameKnowledgeCategory(db, null, "その他");
    expect((await db.knowledgeNote.findFirstOrThrow({ where: { title: "d" } })).category).toBe("その他");
    // 空にすると未分類に戻る
    await renameKnowledgeCategory(db, "その他", "");
    expect((await db.knowledgeNote.findFirstOrThrow({ where: { title: "d" } })).category).toBeNull();

    await expect(renameKnowledgeCategory(db, "存在しない", "x")).rejects.toThrow();
  });
});
