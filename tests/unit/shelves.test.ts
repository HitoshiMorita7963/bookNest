import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createBook, listBooks } from "@/server/services/books";
import { addBookToShelf, createShelf, deleteShelf, removeBookFromShelf, setBookShelves } from "@/server/services/shelves";

beforeEach(resetDb);

describe("Shelf", () => {
  it("creates shelves and prevents duplicates", async () => {
    await createShelf(db, { name: "人生ベスト" });
    await expect(createShelf(db, { name: "人生ベスト" })).rejects.toMatchObject({ code: "DUPLICATE" });
  });

  it("adds/removes books; a book can be on multiple shelves", async () => {
    const s1 = await createShelf(db, { name: "A" });
    const s2 = await createShelf(db, { name: "B" });
    const book = await createBook(db, { title: "本" });
    await addBookToShelf(db, s1.id, book.id);
    await addBookToShelf(db, s1.id, book.id); // 冪等
    await addBookToShelf(db, s2.id, book.id);
    expect(await db.shelfBook.count({ where: { bookId: book.id } })).toBe(2);
    expect((await listBooks(db, { shelfId: s1.id })).total).toBe(1);
    await removeBookFromShelf(db, s1.id, book.id);
    expect(await db.shelfBook.count({ where: { bookId: book.id } })).toBe(1);
    await setBookShelves(db, book.id, [s1.id]);
    expect((await db.shelfBook.findMany({ where: { bookId: book.id } })).map((s) => s.shelfId)).toEqual([s1.id]);
  });

  it("deleting a shelf keeps books", async () => {
    const s = await createShelf(db, { name: "A" });
    const book = await createBook(db, { title: "本" });
    await addBookToShelf(db, s.id, book.id);
    await deleteShelf(db, s.id);
    expect(await db.book.count()).toBe(1);
  });
});
