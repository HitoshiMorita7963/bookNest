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
    creativeNote: await db.creativeNote.count(),
    project: await db.novelProject.count(),
    character: await db.character.count(),
    scene: await db.scene.count(),
    creativeLink: await db.creativeLink.count(),
    aiConv: await db.aIConversation.count({ where: { projectId: { not: null } } }),
  };
}

describe("Backup", () => {
  it("round-trips all data through JSON and does not duplicate on re-import", async () => {
    await loadSampleData(db);
    // 創作データも含めて往復できること
    const book = await db.book.findFirstOrThrow();
    const p = await db.novelProject.create({ data: { title: "作品" } });
    const c = await db.character.create({ data: { projectId: p.id, name: "主人公" } });
    const ch = await db.chapter.create({ data: { projectId: p.id, title: "第1章" } });
    await db.scene.create({ data: { chapterId: ch.id, title: "出会い" } });
    const n = await db.creativeNote.create({ data: { title: "アイデア", tags: { create: [{ tag: { connectOrCreate: { where: { name: "創作" }, create: { name: "創作" } } } }] } } });
    await db.creativeLink.create({ data: { bookId: book.id, characterId: c.id, projectId: p.id, purpose: "人物造形" } });
    await db.creativeLink.create({ data: { noteId: n.id, projectId: p.id } });
    await db.aIConversation.create({ data: { title: "相談", projectId: p.id, messages: { create: [{ role: "user", content: "q" }] } } });
    const before = await counts();
    const json = JSON.stringify(await exportJson(db, { includeAi: true }));

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
