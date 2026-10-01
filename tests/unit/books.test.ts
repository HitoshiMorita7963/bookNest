import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { changeStatus, createBook, deleteBook, getBookDetail, listBooks, updateBook } from "@/server/services/books";
import { searchAll } from "@/server/services/search";
import { parseIsbn, isValidIsbn13, isbn13to10 } from "@/lib/isbn";

beforeEach(resetDb);

describe("ISBN", () => {
  it("validates and converts ISBN", () => {
    expect(isValidIsbn13("9784101010014")).toBe(true);
    expect(isValidIsbn13("9784101010015")).toBe(false);
    expect(isbn13to10("9784101010014")).toBe("4101010013");
    expect(parseIsbn("4-10-101001-3")).toEqual({ isbn13: "9784101010014", isbn10: "4101010013" });
    expect(parseIsbn("978-4-10-101001-4")?.isbn13).toBe("9784101010014");
    expect(parseIsbn("１２３")).toBeNull();
  });
});

describe("Book", () => {
  it("creates a book with authors, tags and series", async () => {
    const book = await createBook(db, {
      title: "こころ",
      authors: ["夏目 漱石"],
      tags: ["日本文学", "近代"],
      isbn: "978-4-10-101001-4",
      pageCount: "384",
      publishedAt: "2004-03",
      seriesTitle: "漱石全集",
      seriesNumber: 1,
      status: "OWNED",
    });
    const d = await getBookDetail(db, book.id);
    expect(d?.title).toBe("こころ");
    expect(d?.isbn13).toBe("9784101010014");
    expect(d?.isbn10).toBe("4101010013");
    expect(d?.pageCount).toBe(384);
    expect(d?.publishedYear).toBe(2004);
    expect(d?.authors.map((a) => a.author.name)).toEqual(["夏目 漱石"]);
    expect(d?.tags.map((t) => t.tag.name).sort()).toEqual(["日本文学", "近代"].sort());
    expect(d?.series?.title).toBe("漱石全集");
    expect(d?.acquiredAt).not.toBeNull(); // 所有で登録すると入手日が入る
  });

  it("rejects empty title and invalid ISBN", async () => {
    await expect(createBook(db, { title: "  " })).rejects.toThrow();
    await expect(createBook(db, { title: "x", isbn: "9784101010015" })).rejects.toThrow(/ISBN/);
  });

  it("prevents duplicate ISBN registration", async () => {
    await createBook(db, { title: "A", isbn: "9784101010014" });
    await expect(createBook(db, { title: "B", isbn: "4101010013" })).rejects.toMatchObject({ code: "DUPLICATE" });
  });

  it("edits a book and replaces authors/tags", async () => {
    const book = await createBook(db, { title: "旧題", authors: ["A"], tags: ["x"] });
    await updateBook(db, book.id, { title: "新題", authors: ["B", "C"], tags: ["y"], status: "WANT_TO_READ" });
    const d = await getBookDetail(db, book.id);
    expect(d?.title).toBe("新題");
    expect(d?.authors.map((a) => a.author.name)).toEqual(["B", "C"]);
    expect(d?.tags.map((t) => t.tag.name)).toEqual(["y"]);
    // 使われなくなった著者・タグは削除される
    expect(await db.author.findUnique({ where: { name: "A" } })).toBeNull();
    expect(await db.tag.findUnique({ where: { name: "x" } })).toBeNull();
  });

  it("deletes a book but keeps its quotes", async () => {
    const book = await createBook(db, { title: "消す本" });
    const q = await db.quote.create({ data: { text: "残る文章", bookId: book.id } });
    await deleteBook(db, book.id);
    expect(await db.book.findUnique({ where: { id: book.id } })).toBeNull();
    const quote = await db.quote.findUnique({ where: { id: q.id } });
    expect(quote?.text).toBe("残る文章");
    expect(quote?.bookId).toBeNull();
  });

  it("searches by title, author, tag and ISBN", async () => {
    await createBook(db, { title: "銀河鉄道の夜", authors: ["宮沢 賢治"], tags: ["幻想"], isbn: "9784101092058" });
    await createBook(db, { title: "国富論", authors: ["アダム・スミス"], tags: ["経済"] });
    expect((await listBooks(db, { q: "銀河" })).total).toBe(1);
    expect((await listBooks(db, { q: "賢治" })).total).toBe(1);
    expect((await listBooks(db, { q: "経済" })).items[0].title).toBe("国富論");
    expect((await listBooks(db, { q: "978-4-10-109205-8" })).total).toBe(1);
    expect((await listBooks(db, { q: "存在しない" })).total).toBe(0);
  });

  it("filters and sorts", async () => {
    const a = await createBook(db, { title: "あ", pageCount: 100, genre: "小説" });
    await createBook(db, { title: "い", pageCount: 500, genre: "科学" });
    await changeStatus(db, a.id, "COMPLETED");
    expect((await listBooks(db, { status: "COMPLETED" })).items.map((b) => b.title)).toEqual(["あ"]);
    expect((await listBooks(db, { genre: "科学" })).total).toBe(1);
    expect((await listBooks(db, { minPages: 200 })).items.map((b) => b.title)).toEqual(["い"]);
    expect((await listBooks(db, { sort: "pageCount", order: "desc" })).items[0].title).toBe("い");
    expect((await listBooks(db, { sort: "title" })).items[0].title).toBe("あ");
  });

  it("cross-search finds reviews", async () => {
    const b = await createBook(db, { title: "自省録" });
    await db.readingRecord.create({ data: { bookId: b.id, status: "COMPLETED", learned: "ストア派の考え方" } });
    const r = await searchAll(db, "ストア派");
    expect(r?.records).toHaveLength(1);
  });
});
