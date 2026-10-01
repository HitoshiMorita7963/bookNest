import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { deleteAllData, exportCsv, exportJson, previewImport, runImport } from "@/server/services/backup";
import { deleteSampleData, loadSampleData } from "@/server/services/sample";

beforeEach(resetDb);

async function counts() {
  return {
    book: await db.book.count(),
    record: await db.readingRecord.count(),
    session: await db.readingSession.count(),
    quote: await db.quote.count(),
    knowledge: await db.knowledgeNote.count(),
    link: await db.knowledgeLink.count(),
    shelfBook: await db.shelfBook.count(),
    pathBook: await db.readingPathBook.count(),
    tag: await db.tag.count(),
  };
}

describe("Backup", () => {
  it("round-trips all data through JSON and does not duplicate on re-import", async () => {
    await loadSampleData(db);
    const before = await counts();
    const json = JSON.stringify(await exportJson(db));

    await deleteAllData(db);
    expect((await counts()).book).toBe(0);

    const preview = await previewImport(db, json);
    expect(preview.counts.book.duplicate).toBe(0);
    await runImport(db, json);
    expect(await counts()).toEqual(before);

    const again = await previewImport(db, json);
    expect(again.counts.book.duplicate).toBe(again.counts.book.total);
    await runImport(db, json);
    expect(await counts()).toEqual(before);
  });

  it("rejects non-BookNest files", async () => {
    await expect(previewImport(db, "not json")).rejects.toThrow();
    await expect(previewImport(db, JSON.stringify({ hello: 1 }))).rejects.toThrow(/BookNest/);
  });

  it("exports CSV with BOM and escaping", async () => {
    await loadSampleData(db);
    const csv = await exportCsv(db, "quotes");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("フレーズ,本,著者");
    expect(csv).toContain("ほんとうのさいわいは一体何だろう。");
  });

  it("deletes only sample data", async () => {
    await loadSampleData(db);
    const mine = await db.book.create({ data: { title: "自分の本" } });
    await deleteSampleData(db);
    expect(await db.book.count()).toBe(1);
    expect((await db.book.findFirst())?.id).toBe(mine.id);
    expect(await db.quote.count()).toBe(0);
  });
});
