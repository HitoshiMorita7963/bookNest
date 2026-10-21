import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./helpers";

// AI には実際には問い合わせず、渡したプロンプトを記録して決まった案を返す
const calls: { system: string; prompt: string }[] = [];
let reply = "　灯りが揺れた。";
vi.mock("@/server/ai/provider", () => ({
  getProvider: () => ({
    json: async (opts: { system: string; prompt: string }) => {
      calls.push(opts);
      return { text: reply };
    },
  }),
}));

const { cleanDraft, continueScene, rewriteSceneText, writerContext } = await import("@/server/ai/writer");

beforeEach(async () => {
  await resetDb();
  calls.length = 0;
  reply = "　灯りが揺れた。";
});

async function project() {
  const p = await db.novelProject.create({ data: { title: "灯台の物語", logline: "灯台守と少女", genre: "ファンタジー" } });
  await db.character.create({ data: { projectId: p.id, name: "ハル", role: "主人公", speechStyle: "ぶっきらぼう", position: 0 } });
  await db.character.create({ data: { projectId: p.id, name: "ミオ", role: "ヒロイン", position: 1 } });
  const c1 = await db.chapter.create({ data: { projectId: p.id, title: "第1章", summary: "嵐の夜", position: 0 } });
  const c2 = await db.chapter.create({ data: { projectId: p.id, title: "第2章", position: 1 } });
  await db.scene.create({ data: { chapterId: c1.id, title: "灯台にて", position: 0, content: "　嵐の夜、扉が叩かれた。" } });
  const s = await db.scene.create({ data: { chapterId: c2.id, title: "朝", summary: "二人で海を見る", position: 0, content: "" } });
  return s;
}

describe("AI writer", () => {
  it("gathers the work, characters and the end of the previous scene (across chapters)", async () => {
    const s = await project();
    const ctx = await writerContext(db, s.id);
    expect(ctx.project.title).toBe("灯台の物語");
    expect(ctx.characters.map((c) => c.name)).toEqual(["ハル", "ミオ"]);
    expect(ctx.prevSceneTail).toBe("　嵐の夜、扉が叩かれた。");
    expect([ctx.chapter.title, ctx.scene.summary]).toEqual(["第2章", "二人で海を見る"]);
  });

  it("asks for a continuation of the chosen length with the context, and returns only the draft", async () => {
    const s = await project();
    const res = await continueScene(db, s.id, { before: "　朝が来た。", after: "", length: "short", instruction: "ミオが笑う" });
    expect(res.text).toBe("　灯りが揺れた。");
    const { prompt } = calls[0];
    for (const part of ["灯台の物語", "ハル（主人公）", "口調：ぶっきらぼう", "前のシーンの終わり", "　朝が来た。", "約200字", "ミオが笑う"]) expect(prompt).toContain(part);
    // 本文は変えない（案を返すだけ）
    expect((await db.scene.findUniqueOrThrow({ where: { id: s.id } })).content).toBe("");
  });

  it("asks to rewrite only the selected part", async () => {
    const s = await project();
    reply = "　「行くぞ」とハルは言った。";
    const res = await rewriteSceneText(db, s.id, { selected: "　ハルは出かけた。", before: "　朝が来た。\n", after: "\n　海が光る。", mode: "dialogue" });
    expect(res.text).toBe("　「行くぞ」とハルは言った。");
    expect(calls[0].prompt).toContain("--- 書き直す部分 ---\n　ハルは出かけた。");
    expect(calls[0].prompt).toContain("会話");
  });

  it("rejects bad requests before calling the AI", async () => {
    const s = await project();
    await expect(rewriteSceneText(db, s.id, { selected: "  ", before: "", after: "", mode: "describe" })).rejects.toThrow("書き直す文を選んで");
    await expect(rewriteSceneText(db, s.id, { selected: "文", before: "", after: "", mode: "free" })).rejects.toThrow("どう書き直すか");
    await expect(continueScene(db, s.id, { before: "", after: "", length: "huge" as never })).rejects.toThrow("長さ");
    await expect(continueScene(db, "nope", { before: "", after: "", length: "short" })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("cleans the draft so it can go straight into the body", () => {
    expect(cleanDraft("```\n\n　続き。\n\n```")).toBe("　続き。");
    expect(cleanDraft("\n\n　一行目。\r\n「二行目」  \n")).toBe("　一行目。\n「二行目」");
  });

  it("refuses an empty draft from the AI", async () => {
    const s = await project();
    reply = "  \n ";
    await expect(continueScene(db, s.id, { before: "", after: "", length: "medium" })).rejects.toThrow("案を作れませんでした");
  });
});
