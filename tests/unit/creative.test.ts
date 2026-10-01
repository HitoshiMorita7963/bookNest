import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createBook } from "@/server/services/books";
import { createQuote } from "@/server/services/quotes";
import { createKnowledge } from "@/server/services/knowledge";
import {
  createCreativeNote,
  createLink,
  creativeUsageOf,
  deleteCreativeNote,
  findSimilarNotes,
  getCreativeNote,
  listCreativeNotes,
  updateCreativeNote,
} from "@/server/services/creative";
import {
  createChapter,
  createCharacter,
  createPlot,
  createProject,
  createRelationship,
  createScene,
  createWorld,
  deleteProject,
  getCharacter,
  getChapter,
  moveItem,
  projectReferences,
  projectTimeline,
} from "@/server/services/novels";

beforeEach(resetDb);

describe("Creative notes", () => {
  it("creates quickly with only content (title derived) and filters by category/status", async () => {
    const n = await createCreativeNote(db, { content: "灯台守の老人が\n毎晩手紙を書く", category: "CHARACTER", tags: ["孤独"] });
    expect(n.title).toBe("灯台守の老人が");
    await createCreativeNote(db, { title: "タイトル案", category: "TITLE" });
    expect((await listCreativeNotes(db, { category: "CHARACTER" })).total).toBe(1);
    expect((await listCreativeNotes(db, { q: "孤独" })).total).toBe(1);
    await updateCreativeNote(db, n.id, { title: n.title, content: n.content, category: "CHARACTER", status: "ARCHIVED", tags: [] });
    expect((await listCreativeNotes(db, {})).total).toBe(1); // アーカイブは既定で非表示
    expect((await listCreativeNotes(db, { status: "ARCHIVED" })).total).toBe(1);
    await expect(createCreativeNote(db, { title: " ", content: " " })).rejects.toThrow();
  });

  it("finds similar notes by text overlap", async () => {
    const a = await createCreativeNote(db, { title: "孤独な灯台守", content: "海辺の灯台で一人暮らす老人" });
    await createCreativeNote(db, { title: "灯台の少女", content: "灯台守の老人を訪ねる少女" });
    await createCreativeNote(db, { title: "宇宙船", content: "火星へ向かう貨物船" });
    const sim = await findSimilarNotes(db, `${a.title} ${a.content}`, { excludeId: a.id });
    expect(sim.map((s) => s.title)).toEqual(["灯台の少女"]);
  });
});

describe("Novel project structure", () => {
  it("project → character → chapter → scene, with ordering and relationships", async () => {
    const p = await createProject(db, { title: "灯台の物語", logline: "孤独な灯台守と少女の話", status: "PLANNING" });
    const hero = await createCharacter(db, p.id, { name: "ハル", role: "主人公", goal: "灯台を守る" });
    const girl = await createCharacter(db, p.id, { name: "ミオ", role: "ヒロイン" });
    await createRelationship(db, p.id, { fromId: hero.id, toId: girl.id, label: "恋愛" });
    await expect(createRelationship(db, p.id, { fromId: hero.id, toId: hero.id, label: "x" })).rejects.toThrow();
    const ch1 = await createChapter(db, p.id, { title: "出会い" });
    const ch2 = await createChapter(db, p.id, { title: "旅立ち" });
    await moveItem(db, "chapter", ch2.id, -1);
    const chapters = await db.chapter.findMany({ where: { projectId: p.id }, orderBy: { position: "asc" } });
    expect(chapters.map((c) => c.title)).toEqual(["旅立ち", "出会い"]);
    const s = await createScene(db, ch1.id, { title: "再会", status: "DRAFT" });
    expect((await getChapter(db, ch1.id))?.scenes.map((x) => x.title)).toEqual(["再会"]);
    expect(s.status).toBe("DRAFT");
    const c = await getCharacter(db, hero.id);
    expect(c?.relationsFrom[0].label).toBe("恋愛");
    await createWorld(db, p.id, { title: "港町", category: "地理" });
    await createPlot(db, p.id, { title: "起" });
    await deleteProject(db, p.id);
    expect(await db.character.count()).toBe(0);
    expect(await db.scene.count()).toBe(0);
  });
});

describe("Reading → creative links", () => {
  it("book → note → project, quote → character, knowledge → scene; reverse lookups and influence", async () => {
    const book = await createBook(db, { title: "灯台へ", authors: ["ウルフ"] });
    const quote = await createQuote(db, { text: "人は誰でも孤独な灯台だ", bookId: book.id });
    const knowledge = await createKnowledge(db, { title: "灯台の構造", content: "フレネルレンズ" });
    const p = await createProject(db, { title: "灯台の物語" });
    const hero = await createCharacter(db, p.id, { name: "ハル" });
    const ch = await createChapter(db, p.id, { title: "第3章" });
    const scene = await createScene(db, ch.id, { title: "再会" });

    // テスト1：本 → 創作メモ → 作品
    const note = await createCreativeNote(db, { title: "灯台守の孤独", category: "THEME" });
    await createLink(db, { source: { kind: "book", id: book.id }, target: { kind: "note", id: note.id } });
    await createLink(db, { source: { kind: "note", id: note.id }, target: { kind: "project", id: p.id }, purpose: "テーマ" });
    expect((await db.creativeNote.findUnique({ where: { id: note.id } }))?.status).toBe("IN_USE");
    // テスト2：フレーズ → 人物
    await createLink(db, { source: { kind: "quote", id: quote.id }, target: { kind: "character", id: hero.id }, purpose: "人物造形" });
    // テスト3：知識 → シーン
    await createLink(db, { source: { kind: "knowledge", id: knowledge.id }, target: { kind: "scene", id: scene.id }, purpose: "考証・資料" });
    // 同じ組み合わせは用途だけ更新される
    await createLink(db, { source: { kind: "quote", id: quote.id }, target: { kind: "character", id: hero.id }, purpose: "会話" });
    expect(await db.creativeLink.count({ where: { quoteId: quote.id } })).toBe(1);

    // 作品内の要素に紐付けた場合も作品 ID が入る（作品単位の集計のため）
    const sceneLink = await db.creativeLink.findFirst({ where: { sceneId: scene.id } });
    expect(sceneLink?.projectId).toBe(p.id);

    // 逆引き：本 → 創作メモ経由で作品
    const usage = await creativeUsageOf(db, { kind: "book", id: book.id });
    expect(usage.notes.map((n) => n.title)).toEqual(["灯台守の孤独"]);
    expect(usage.projects[0].title).toBe("灯台の物語");
    // 逆引き：フレーズ → 人物
    const qUsage = await creativeUsageOf(db, { kind: "quote", id: quote.id });
    expect(qUsage.projects[0].counts.character).toBe(1);
    expect(qUsage.projects[0].items[0].purpose).toBe("会話");
    // 逆引き：知識 → シーン
    expect((await creativeUsageOf(db, { kind: "knowledge", id: knowledge.id })).projects[0].counts.scene).toBe(1);
    // 創作メモ：元の資料と使われている作品
    const n = await getCreativeNote(db, note.id);
    expect(n?.materials[0].book?.title).toBe("灯台へ");
    expect(n?.usedIn[0].project?.title).toBe("灯台の物語");

    // 作品に影響を与えたもの（メモ経由の本・フレーズの出典の本も数える）
    const refs = await projectReferences(db, p.id);
    expect(refs.counts).toEqual({ book: 1, quote: 1, knowledge: 1, note: 1 });

    // 創作タイムライン
    const tl = await projectTimeline(db, p.id);
    expect(tl.some((e) => e.label.includes("人物「ハル」"))).toBe(true);
    expect(tl.some((e) => e.label.includes("フレーズ保存"))).toBe(true);

    // 元データを削除すると紐付けも消える
    await deleteCreativeNote(db, note.id);
    expect(await db.creativeLink.count({ where: { noteId: note.id } })).toBe(0);
  });

  it("rejects links to missing data", async () => {
    const p = await createProject(db, { title: "P" });
    await expect(createLink(db, { source: { kind: "book", id: "nope" }, target: { kind: "project", id: p.id } })).rejects.toMatchObject({ code: "NOT_FOUND" });
    const note = await createCreativeNote(db, { title: "x" });
    await expect(createLink(db, { source: { kind: "note", id: note.id }, target: { kind: "character", id: "nope" } })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
