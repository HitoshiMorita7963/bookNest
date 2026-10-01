import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { changeStatus, createBook } from "@/server/services/books";
import { finishReading, startReading, startReread, updateProgress, updateRecord, deleteRecord } from "@/server/services/reading";

beforeEach(resetDb);

describe("Reading", () => {
  it("start → progress → finish", async () => {
    const book = await createBook(db, { title: "本", pageCount: 300, status: "OWNED" });
    await startReading(db, book.id);
    let b = await db.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(b.status).toBe("READING");
    expect(b.startedAt).not.toBeNull();

    await updateProgress(db, book.id, { currentPage: 120, minutes: 30, note: "面白い" });
    await updateProgress(db, book.id, { currentPage: 183 });
    b = await db.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(b.currentPage).toBe(183);
    const sessions = await db.readingSession.findMany({ where: { bookId: book.id }, orderBy: { createdAt: "asc" } });
    expect(sessions.map((s) => s.pagesRead)).toEqual([120, 63]);
    expect(sessions[0].note).toBe("面白い");

    await finishReading(db, book.id, { rating: 5, review: "良かった", learned: "学び" });
    b = await db.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(b.status).toBe("COMPLETED");
    expect(b.rating).toBe(5);
    expect(b.currentPage).toBe(300);
    expect(b.finishedAt).not.toBeNull();
    const records = await db.readingRecord.findMany({ where: { bookId: book.id } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ status: "COMPLETED", rating: 5, review: "良かった", learned: "学び" });
    // 残りページも読了時にセッションとして記録される
    const total = await db.readingSession.aggregate({ where: { bookId: book.id }, _sum: { pagesRead: true } });
    expect(total._sum.pagesRead).toBe(300);
  });

  it("finish without input is allowed", async () => {
    const book = await createBook(db, { title: "本", status: "READING" });
    await finishReading(db, book.id);
    const b = await db.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(b.status).toBe("COMPLETED");
  });

  it("rejects progress beyond page count", async () => {
    const book = await createBook(db, { title: "本", pageCount: 100, status: "READING" });
    await expect(updateProgress(db, book.id, { currentPage: 150 })).rejects.toThrow(/100/);
  });

  it("progress on unread book starts reading", async () => {
    const book = await createBook(db, { title: "本", pageCount: 100 });
    await updateProgress(db, book.id, { currentPage: 10 });
    const b = await db.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(b.status).toBe("READING");
  });

  it("reread keeps history", async () => {
    const book = await createBook(db, { title: "本", pageCount: 100, status: "READING" });
    await finishReading(db, book.id, { rating: 5, finishedAt: "2024-05-01" });
    await startReread(db, book.id);
    let b = await db.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(b.status).toBe("READING");
    expect(b.currentPage).toBe(0);
    await finishReading(db, book.id, { rating: 4, finishedAt: "2026-02-01" });
    const records = await db.readingRecord.findMany({ where: { bookId: book.id }, orderBy: { finishedAt: "asc" } });
    expect(records.map((r) => r.rating)).toEqual([5, 4]);
    b = await db.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(b.rating).toBe(4);
    await expect(startReread(db, book.id)).resolves.toBeTruthy();
    await expect(startReread(db, book.id)).rejects.toThrow(/読書中/);
  });

  it("status change creates records and pausing keeps it open", async () => {
    const book = await createBook(db, { title: "本" });
    await changeStatus(db, book.id, "READING");
    await changeStatus(db, book.id, "PAUSED");
    let rec = await db.readingRecord.findFirstOrThrow({ where: { bookId: book.id } });
    expect(rec.status).toBe("PAUSED");
    await startReading(db, book.id);
    rec = await db.readingRecord.findFirstOrThrow({ where: { bookId: book.id } });
    expect(rec.status).toBe("READING");
    expect(await db.readingRecord.count({ where: { bookId: book.id } })).toBe(1);
  });

  it("editing/deleting records re-syncs book fields", async () => {
    const book = await createBook(db, { title: "本", status: "READING" });
    const rec = await finishReading(db, book.id, { rating: 3 });
    await updateRecord(db, rec.id, { status: "COMPLETED", rating: 5, finishedAt: rec.finishedAt });
    expect((await db.book.findUniqueOrThrow({ where: { id: book.id } })).rating).toBe(5);
    await deleteRecord(db, rec.id);
    const b = await db.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(b.rating).toBeNull();
    expect(b.finishedAt).toBeNull();
  });
});
