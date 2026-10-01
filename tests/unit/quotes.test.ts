import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createBook } from "@/server/services/books";
import { createQuote, deleteQuote, getQuote, listQuotes, toggleFavorite, updateQuote } from "@/server/services/quotes";
import { cleanOcrText, guessVertical } from "@/lib/ocr/text";

beforeEach(resetDb);

describe("OCR text cleanup", () => {
  it("removes spaces between Japanese characters", () => {
    expect(cleanOcrText("人 は 、 自 分 が 思っ て いる ほど")).toBe("人は、自分が思っているほど");
  });
  it("joins lines within a paragraph but keeps paragraph breaks", () => {
    const raw = "人は、自分が思っているほど\n自分自身を知らない。\n\n次の段落\nです。";
    expect(cleanOcrText(raw, { joinLines: true })).toBe("人は、自分が思っているほど自分自身を知らない。\n\n次の段落です。");
    expect(cleanOcrText(raw, { joinLines: false })).toBe(raw);
  });
  it("keeps spaces between English words and normalizes full-width alphanumerics", () => {
    expect(cleanOcrText("Ｈｅｌｌｏ ｗｏｒｌｄ １２３")).toBe("Hello world 123");
    expect(cleanOcrText("GPU は 重要")).toBe("GPUは重要");
  });
  it("guesses vertical writing from crop aspect", () => {
    expect(guessVertical(300, 800)).toBe(true);
    expect(guessVertical(800, 300)).toBe(false);
  });
});

describe("Quote", () => {
  it("saves a quote linked to a book with page/tags/note", async () => {
    const book = await createBook(db, { title: "こころ", authors: ["夏目 漱石"] });
    const q = await createQuote(db, { text: "精神的に向上心のないものは馬鹿だ。", bookId: book.id, pageNumber: "142-143", tags: ["人生", "人生", "成長"], note: "刺さった" });
    const got = await getQuote(db, q.id);
    expect(got?.book?.title).toBe("こころ");
    expect(got?.book?.authors[0].author.name).toBe("夏目 漱石");
    expect(got?.pageNumber).toBe("142-143");
    expect(got?.tags.map((t) => t.tag.name).sort()).toEqual(["人生", "成長"].sort());
    expect(got?.note).toBe("刺さった");
  });

  it("accepts non-numeric page labels", async () => {
    for (const p of ["序章", "位置No.1234", "142"]) {
      const q = await createQuote(db, { text: "x", pageNumber: p });
      expect(q.pageNumber).toBe(p);
    }
  });

  it("rejects empty text and unknown book", async () => {
    await expect(createQuote(db, { text: "   " })).rejects.toThrow();
    await expect(createQuote(db, { text: "x", bookId: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("edits OCR text and tags", async () => {
    const q = await createQuote(db, { text: "人は、自分が思つているほど", tags: ["a"] });
    await updateQuote(db, q.id, { text: "人は、自分が思っているほど", tags: ["b"] });
    const got = await getQuote(db, q.id);
    expect(got?.text).toBe("人は、自分が思っているほど");
    expect(got?.tags.map((t) => t.tag.name)).toEqual(["b"]);
    expect(await db.tag.findUnique({ where: { name: "a" } })).toBeNull();
  });

  it("searches by text, book, author, tag and note", async () => {
    const book = await createBook(db, { title: "自省録", authors: ["マルクス・アウレリウス"] });
    await createQuote(db, { text: "今を生きよ", bookId: book.id, tags: ["人生"], note: "朝に読みたい" });
    await createQuote(db, { text: "別の文章" });
    expect((await listQuotes(db, { q: "今を" })).total).toBe(1);
    expect((await listQuotes(db, { q: "自省録" })).total).toBe(1);
    expect((await listQuotes(db, { q: "アウレリウス" })).total).toBe(1);
    expect((await listQuotes(db, { tag: "人生" })).total).toBe(1);
    expect((await listQuotes(db, { q: "朝に" })).total).toBe(1);
    expect((await listQuotes(db, { bookId: book.id })).total).toBe(1);
  });

  it("toggles favorite and deletes", async () => {
    const q = await createQuote(db, { text: "x" });
    await toggleFavorite(db, q.id);
    expect((await listQuotes(db, { favorite: true })).total).toBe(1);
    await deleteQuote(db, q.id);
    expect(await db.quote.count()).toBe(0);
  });
});
