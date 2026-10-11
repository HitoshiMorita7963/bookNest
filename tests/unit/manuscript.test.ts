import { beforeEach, describe, expect, it } from "vitest";
import JSZip from "jszip";
import { db, resetDb } from "./helpers";
import { countChars, manuscriptFileName, manuscriptText, parseInline, plainLine, type Manuscript } from "@/lib/manuscript";
import { getManuscript, manuscriptDocx } from "@/server/services/manuscript";

beforeEach(resetDb);

const ms: Manuscript = {
  title: "灯台の物語",
  logline: "孤独な灯台守と少女",
  chapters: [
    { title: "第1章　出会い", scenes: [{ title: "嵐の夜", content: "　|灯台守《とうだいもり》は《《ひとり》》だった。\n\n　少女が来た。" }, { title: "まだ書いていない", content: "  " }, { title: "朝", content: "　海が光る。" }] },
    { title: "第2章　未着手", scenes: [{ title: "空", content: "" }] },
  ],
};

describe("manuscript notation", () => {
  it("reads ruby and emphasis like novel posting sites", () => {
    expect(parseInline("|灯台守《とうだいもり》は《《ひとり》》だ")).toEqual([{ base: "灯台守", ruby: "とうだいもり" }, { text: "は" }, { emphasis: "ひとり" }, { text: "だ" }]);
    // 「|」がないときは《》の直前の漢字だけに振る
    expect(parseInline("その少女《しょうじょ》")).toEqual([{ text: "その" }, { base: "少女", ruby: "しょうじょ" }]);
    expect(parseInline("｜ハル《春》")).toEqual([{ base: "ハル", ruby: "春" }]);
    expect(parseInline("記法なし")).toEqual([{ text: "記法なし" }]);
    expect(plainLine("|灯台守《とうだいもり》は《《ひとり》》")).toBe("灯台守はひとり");
  });

  it("counts characters without spaces, line breaks or notation", () => {
    expect(countChars("　|灯台守《とうだいもり》は\n\n《《ひとり》》。")).toBe(8);
  });

  it("makes a safe file name", () => {
    expect(manuscriptFileName('灯台/の:物語?', "docx")).toBe("灯台の物語.docx");
    expect(manuscriptFileName("  ", "txt")).toBe("原稿.txt");
  });
});

describe("manuscript export", () => {
  it("writes plain text with scene titles or scene breaks, skipping empty scenes and chapters", () => {
    const withTitles = manuscriptText(ms, { sceneTitles: true });
    expect(withTitles).toContain("第1章　出会い\n\n◆嵐の夜\n\n　|灯台守《とうだいもり》は《《ひとり》》だった。\n\n　少女が来た。\n\n◆朝");
    expect(withTitles).not.toContain("まだ書いていない");
    expect(withTitles).not.toContain("第2章");
    const noTitles = manuscriptText(ms, { sceneTitles: false });
    expect(noTitles).not.toContain("◆");
    expect(noTitles).toContain("少女が来た。\n\n◇\n\n　海が光る。");
  });

  it("builds a Word file with headings, ruby and emphasis", async () => {
    const zip = await JSZip.loadAsync(await manuscriptDocx(ms, { sceneTitles: true }));
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml"]));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain('<w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">灯台の物語</w:t>');
    expect(xml).toContain('<w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">第1章　出会い</w:t>');
    expect(xml).toContain('<w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t xml:space="preserve">嵐の夜</w:t>');
    expect(xml).toMatch(/<w:rt>.*とうだいもり.*<\/w:rt><w:rubyBase>.*灯台守.*<\/w:rubyBase>/);
    expect(xml).toContain('<w:em w:val="dot"/>');
    expect(xml).not.toContain("第2章");
  });

  it("escapes characters that would break the Word file", async () => {
    const zip = await JSZip.loadAsync(await manuscriptDocx({ title: "A&B <C>", logline: null, chapters: [{ title: "章", scenes: [{ title: "s", content: "x < y & z\u0001" }] }] }, { sceneTitles: false }));
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("A&amp;B &lt;C&gt;");
    expect(xml).toContain("x &lt; y &amp; z<");
  });

  it("reads chapters and scenes in their order", async () => {
    const p = await db.novelProject.create({ data: { title: "順番", chapters: { create: [{ title: "二", position: 1 }, { title: "一", position: 0 }] } }, include: { chapters: true } });
    const one = p.chapters.find((c) => c.title === "一")!;
    await db.scene.createMany({ data: [{ chapterId: one.id, title: "b", position: 1, content: "B" }, { chapterId: one.id, title: "a", position: 0, content: "A" }] });
    const got = await getManuscript(db, p.id);
    expect(got.chapters.map((c) => [c.title, c.scenes.map((s) => s.title)])).toEqual([["一", ["a", "b"]], ["二", []]]);
    await expect(getManuscript(db, "nope")).rejects.toThrow();
  });
});

describe("scene body", () => {
  it("keeps the indentation at the start of the body", async () => {
    const { sceneInputSchema } = await import("@/lib/validators");
    const parse = (content: string) => sceneInputSchema.parse({ title: "s", content }).content;
    expect(parse("\n\n　書き出し。\r\n　次の段落。  \n\n")).toBe("　書き出し。\n　次の段落。");
    expect(parse(" \u3000\n")).toBeNull();
  });
});
