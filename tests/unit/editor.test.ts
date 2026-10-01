import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createBook } from "@/server/services/books";
import { createQuote } from "@/server/services/quotes";
import { createKnowledge } from "@/server/services/knowledge";
import { createCreativeNote, createLink } from "@/server/services/creative";
import { createChapter, createCharacter, createProject, createScene } from "@/server/services/novels";
import { applyProposal, askEditor } from "@/server/ai/editor";
import { runCreativeTool } from "@/server/ai/creative-tools";

beforeEach(resetDb);

async function setup() {
  const book = await createBook(db, { title: "灯台へ" });
  const quote = await createQuote(db, { text: "人は誰でも孤独な灯台だ", bookId: book.id });
  const knowledge = await createKnowledge(db, { title: "フレネルレンズ" });
  const p = await createProject(db, { title: "灯台の物語", theme: "孤独" });
  const hero = await createCharacter(db, p.id, { name: "ハル", role: "主人公" });
  const ch = await createChapter(db, p.id, { title: "第3章" });
  const scene = await createScene(db, ch.id, { title: "再会" });
  const note = await createCreativeNote(db, { title: "灯台のモチーフ", category: "MOTIF" });
  await createLink(db, { source: { kind: "book", id: book.id }, target: { kind: "note", id: note.id } });
  await createLink(db, { source: { kind: "note", id: note.id }, target: { kind: "project", id: p.id } });
  await createLink(db, { source: { kind: "quote", id: quote.id }, target: { kind: "character", id: hero.id } });
  await createLink(db, { source: { kind: "knowledge", id: knowledge.id }, target: { kind: "scene", id: scene.id } });
  return { book, quote, knowledge, p, hero, ch, scene, note };
}

describe("AI editor (search mode, no provider)", () => {
  it("finds reading materials linked to the project (including via notes) and saves per-project history", async () => {
    delete process.env.AI_API_KEY;
    const { p, ch, hero } = await setup();
    const r = await askEditor(db, p.id, null, "関連する読書資料を探して", { chapterId: ch.id, characterId: hero.id });
    expect(r.message.mode).toBe("local");
    expect(r.message.sources.books.map((b) => b.title)).toContain("灯台へ");
    expect(r.message.sources.quotes).toHaveLength(1);
    expect(r.message.sources.knowledge.map((k) => k.title)).toContain("フレネルレンズ");
    expect(r.message.sources.creative.map((c) => c.label)).toContain("灯台のモチーフ");
    const conv = await db.aIConversation.findUniqueOrThrow({ where: { id: r.conversationId } });
    expect(conv.projectId).toBe(p.id);
    // 読書資料を対象外にすると本は返さない
    const r2 = await askEditor(db, p.id, r.conversationId, "関連する読書資料を探して", { includeReading: false });
    expect(r2.message.sources.books).toHaveLength(0);
  });

  it("creative tools return project data and record references", async () => {
    const { p, hero } = await setup();
    const refs = new Map();
    const sources = { books: new Map(), quotes: new Map(), knowledge: new Map() };
    const structure = JSON.parse(await runCreativeTool(db, "get_project_structure", {}, p.id, refs, sources));
    expect(structure.characters[0].name).toBe("ハル");
    const ch = JSON.parse(await runCreativeTool(db, "get_character", { character_id: hero.id }, p.id, refs, sources));
    expect(ch.references[0].quote).toContain("灯台");
    expect(sources.quotes.size).toBe(1);
    const other = await createProject(db, { title: "別作品" });
    // 他の作品の人物は取得できない
    expect(JSON.parse(await runCreativeTool(db, "get_character", { character_id: hero.id }, other.id, refs, sources)).error).toBeTruthy();
  });
});

describe("AI proposals are applied only when the user accepts", () => {
  it("applies whitelisted field updates and note creation; rejects others", async () => {
    const { p, hero } = await setup();
    await applyProposal(db, p.id, { type: "update", target: "character", id: hero.id, field: "goal", value: "灯台を次の世代に託す" });
    expect((await db.character.findUniqueOrThrow({ where: { id: hero.id } })).goal).toBe("灯台を次の世代に託す");
    await applyProposal(db, p.id, { type: "update", target: "project", id: p.id, field: "logline", value: "孤独な灯台守の物語" });
    expect((await db.novelProject.findUniqueOrThrow({ where: { id: p.id } })).logline).toBe("孤独な灯台守の物語");
    const created = await applyProposal(db, p.id, { type: "create_note", title: "AIの案", content: "内容", category: "PLOT" });
    expect(await db.creativeLink.count({ where: { noteId: created.id, projectId: p.id } })).toBe(1);
    await expect(applyProposal(db, p.id, { type: "update", target: "character", id: hero.id, field: "name", value: "x" })).rejects.toThrow();
    const other = await createProject(db, { title: "別作品" });
    await expect(applyProposal(db, other.id, { type: "update", target: "character", id: hero.id, field: "goal", value: "x" })).rejects.toThrow();
  });
});
