import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { db, resetDb } from "./helpers";
import { createBook } from "@/server/services/books";
import { createQuote } from "@/server/services/quotes";
import { createKnowledge } from "@/server/services/knowledge";
import { createCreativeNote, createLink } from "@/server/services/creative";
import { createCharacter, createChapter, createProject, createScene } from "@/server/services/novels";
import { buildSheets, toXlsx } from "@/server/services/workbook";

beforeEach(resetDb);

describe("Excel export of all data", () => {
  it("puts every kind of data on its own readable sheet", async () => {
    const book = await createBook(db, { title: "灯台へ", authors: ["ヴァージニア・ウルフ"], pageCount: 320, status: "COMPLETED", tags: ["海外文学"], seriesTitle: "名作", seriesNumber: 1 });
    await createQuote(db, { text: "=人は誰でも孤独な灯台だ", bookId: book.id, isFavorite: true });
    await createKnowledge(db, { title: "フレネルレンズ", content: "段状のレンズ" });
    const p = await createProject(db, { title: "灯台の物語" });
    const hero = await createCharacter(db, p.id, { name: "ハル", role: "主人公" });
    const ch = await createChapter(db, p.id, { title: "第1章" });
    await createScene(db, ch.id, { title: "再会" });
    const note = await createCreativeNote(db, { title: "灯台のモチーフ", category: "MOTIF" });
    await createLink(db, { source: { kind: "book", id: book.id }, target: { kind: "character", id: hero.id }, purpose: "人物造形" });
    await createLink(db, { source: { kind: "note", id: note.id }, target: { kind: "project", id: p.id } });

    const sheets = await buildSheets(db);
    const byName = Object.fromEntries(sheets.map((s) => [s.name, s]));
    expect(Object.keys(byName)).toEqual(expect.arrayContaining(["本", "読書記録", "フレーズ", "知識", "創作メモ", "作品", "人物", "章・シーン", "読書と創作の紐付け", "シリーズ"]));
    for (const s of sheets) for (const r of s.rows) expect(r).toHaveLength(s.headers.length);
    const bookRow = byName["本"].rows[0];
    expect(bookRow[0]).toBe("灯台へ");
    expect(bookRow[byName["本"].headers.indexOf("著者")]).toBe("ヴァージニア・ウルフ");
    expect(bookRow[byName["本"].headers.indexOf("ステータス")]).toBe("読了");
    expect(byName["読書と創作の紐付け"].rows).toContainEqual(expect.arrayContaining(["本", "灯台へ", "人物", "ハル", "灯台の物語", "人物造形"]));
    expect(byName["章・シーン"].rows[0]).toEqual(expect.arrayContaining(["灯台の物語", "第1章", "再会"]));

    // Excel ファイルとして読み戻せる（数式として扱われない）
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await toXlsx(sheets)) as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(sheets.map((s) => s.name));
    const quoteCell = wb.getWorksheet("フレーズ")!.getRow(2).getCell(1);
    expect(quoteCell.value).toBe("=人は誰でも孤独な灯台だ");
    expect(wb.getWorksheet("本")!.getRow(1).getCell(1).value).toBe("タイトル");
  });
});
