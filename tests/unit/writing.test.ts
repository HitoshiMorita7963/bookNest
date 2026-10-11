import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { projectToc, saveSceneContent, sceneForWriting, setSceneStatus } from "@/server/services/writing";
import { updateScene } from "@/server/services/novels";

beforeEach(resetDb);

async function project() {
  const p = await db.novelProject.create({ data: { title: "灯台の物語" } });
  const c1 = await db.chapter.create({ data: { projectId: p.id, title: "第1章", position: 0 } });
  const c2 = await db.chapter.create({ data: { projectId: p.id, title: "第2章", position: 1 } });
  const a = await db.scene.create({ data: { chapterId: c1.id, title: "a", position: 0, content: "　|灯台《とうだい》の夜。" } });
  const b = await db.scene.create({ data: { chapterId: c1.id, title: "b", position: 1 } });
  const c = await db.scene.create({ data: { chapterId: c2.id, title: "c", position: 0, content: "朝。" } });
  return { p, a, b, c };
}

describe("writing", () => {
  it("lists the table of contents with character counts and where to resume", async () => {
    const { p, c } = await project();
    const toc = await projectToc(db, p.id);
    expect(toc.chapters.map((ch) => [ch.title, ch.chars, ch.scenes.map((s) => [s.title, s.chars])])).toEqual([
      ["第1章", 5, [["a", 5], ["b", 0]]],
      ["第2章", 2, [["c", 2]]],
    ]);
    expect([toc.totalChars, toc.sceneCount]).toEqual([7, 3]);
    // 最後に更新した、本文のあるシーンから続きを書く
    expect(toc.resume?.id).toBe(c.id);
  });

  it("starts from the first scene when nothing is written yet, and handles an empty project", async () => {
    const p = await db.novelProject.create({ data: { title: "空" } });
    expect((await projectToc(db, p.id)).resume).toBeNull();
    const ch = await db.chapter.create({ data: { projectId: p.id, title: "一" } });
    const s = await db.scene.create({ data: { chapterId: ch.id, title: "最初" } });
    expect((await projectToc(db, p.id)).resume?.id).toBe(s.id);
  });

  it("finds the previous and next scenes across chapters", async () => {
    const { a, b, c } = await project();
    const mid = await sceneForWriting(db, b.id);
    expect([mid?.prev?.id, mid?.next?.id, mid?.next?.chapterTitle]).toEqual([a.id, c.id, "第2章"]);
    expect((await sceneForWriting(db, a.id))?.prev).toBeNull();
    expect((await sceneForWriting(db, c.id))?.next).toBeNull();
    expect(await sceneForWriting(db, "nope")).toBeNull();
  });

  it("saves the body, keeping the indent, and refuses to overwrite a newer version unless forced", async () => {
    const { b } = await project();
    const base = b.updatedAt.toISOString();
    const first = await saveSceneContent(db, b.id, { content: "\n　書き出し。  ", baseUpdatedAt: base });
    expect(first.ok).toBe(true);
    expect((await db.scene.findUniqueOrThrow({ where: { id: b.id } })).content).toBe("　書き出し。");

    // 古い基準のまま別の内容を送る（別の端末で開いたままだった画面など）→ 衝突
    const stale = await saveSceneContent(db, b.id, { content: "古い画面の文章", baseUpdatedAt: base });
    expect(stale).toMatchObject({ ok: false, conflict: true, content: "　書き出し。" });
    // 同じ内容なら衝突にしない
    expect((await saveSceneContent(db, b.id, { content: "　書き出し。", baseUpdatedAt: base })).ok).toBe(true);
    // 上書きを選んだとき
    expect((await saveSceneContent(db, b.id, { content: "古い画面の文章", baseUpdatedAt: base, force: true })).ok).toBe(true);
    expect((await db.scene.findUniqueOrThrow({ where: { id: b.id } })).content).toBe("古い画面の文章");
    // 空にすると本文なし
    await saveSceneContent(db, b.id, { content: "  ", force: true });
    expect((await db.scene.findUniqueOrThrow({ where: { id: b.id } })).content).toBeNull();
  });

  it("keeps the body when the scene's name or summary is edited", async () => {
    const { a } = await project();
    await updateScene(db, a.id, { title: "a（改題）", summary: "灯台の夜", status: "DRAFT" });
    const got = await db.scene.findUniqueOrThrow({ where: { id: a.id } });
    expect([got.title, got.content]).toEqual(["a（改題）", "　|灯台《とうだい》の夜。"]);
  });

  it("changes the status and rejects an unknown one", async () => {
    const { a } = await project();
    await setSceneStatus(db, a.id, "REVISED");
    expect((await db.scene.findUniqueOrThrow({ where: { id: a.id } })).status).toBe("REVISED");
    await expect(setSceneStatus(db, a.id, "BOGUS")).rejects.toThrow();
  });
});
