import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createCreativeKnowledge, deleteCreativeKnowledge, addCkRelation, setCkMyNote } from "@/server/services/creative-knowledge";
import { createCreativeNote, createLink, creativeUsageOf, getCreativeNote } from "@/server/services/creative";
import { createChapter, createCharacter, createProject, createScene, getCharacter, getScene, projectReferences } from "@/server/services/novels";
import { ckAiContext, projectCkContext, searchCkForAi } from "@/server/services/creative-knowledge-ai";
import { runCreativeTool, type CreativeRefs } from "@/server/ai/creative-tools";

beforeEach(resetDb);

async function setup() {
  const ck = await createCreativeKnowledge(db, {
    title: "敵から味方へ",
    category: "TROPE",
    summary: "敵対していた人物が主人公側に加わる展開。",
    effects: "意外性\n人間関係の変化",
    usage: "敵対の理由を先に描く",
  });
  const parent = await createCreativeKnowledge(db, { title: "人物の変化", category: "CHARACTER" });
  await addCkRelation(db, { fromId: ck.id, toId: parent.id, type: "parent" });
  const p = await createProject(db, { title: "灯台の物語" });
  const hero = await createCharacter(db, p.id, { name: "ミナ", role: "敵役" });
  const ch = await createChapter(db, p.id, { title: "第3章" });
  const scene = await createScene(db, ch.id, { title: "共闘" });
  return { ck, parent, p, hero, ch, scene };
}

describe("creative knowledge → works (CreativeLink.ckId)", () => {
  it("links a creative knowledge to a character / scene and shows it with title and category", async () => {
    const { ck, p, hero, scene } = await setup();
    const l1 = await createLink(db, { source: { kind: "ck", id: ck.id }, target: { kind: "character", id: hero.id }, purpose: "ミナの改心" });
    expect(l1.ckId).toBe(ck.id);
    // 作品内の要素に付けると作品にも属する
    expect(l1.projectId).toBe(p.id);
    await createLink(db, { source: { kind: "ck", id: ck.id }, target: { kind: "scene", id: scene.id } });
    // 同じ組み合わせは用途だけ更新
    await createLink(db, { source: { kind: "ck", id: ck.id }, target: { kind: "character", id: hero.id }, purpose: "改心の流れ" });
    expect(await db.creativeLink.count({ where: { ckId: ck.id } })).toBe(2);

    const character = await getCharacter(db, hero.id);
    expect(character?.links[0].ck?.title).toBe("敵から味方へ");
    const sc = await getScene(db, scene.id);
    expect(sc?.links[0].ck?.category).toBe("TROPE");

    const refs = await projectReferences(db, p.id);
    expect(refs.counts.ck).toBe(1);
    const item = refs.items.find((i) => i.source.kind === "ck")!;
    expect(item.source.label).toBe("敵から味方へ");
    expect(item.source.sub).toBe("トロープ・定番");
    expect(item.source.href).toBe(`/creative/knowledge/${ck.id}`);
  });

  it("rejects a missing creative knowledge", async () => {
    const { p } = await setup();
    await expect(createLink(db, { source: { kind: "ck", id: "nope" }, target: { kind: "project", id: p.id } })).rejects.toThrow(/創作知識/);
  });

  it("reverse lookup: works and notes that use the creative knowledge", async () => {
    const { ck, p, hero } = await setup();
    await createLink(db, { source: { kind: "ck", id: ck.id }, target: { kind: "character", id: hero.id }, purpose: "改心" });
    const note = await createCreativeNote(db, { title: "ミナの過去", category: "CHARACTER" });
    await createLink(db, { source: { kind: "ck", id: ck.id }, target: { kind: "note", id: note.id } });
    const usage = await creativeUsageOf(db, { kind: "ck", id: ck.id });
    expect(usage.projects).toHaveLength(1);
    expect(usage.projects[0].id).toBe(p.id);
    expect(usage.projects[0].items[0]).toMatchObject({ kind: "character", label: "ミナ", purpose: "改心" });
    expect(usage.notes.map((n) => n.title)).toEqual(["ミナの過去"]);
    // 創作メモの「元になった資料」にも創作知識が表示される
    const n = await getCreativeNote(db, note.id);
    expect(n?.materials[0].ck?.title).toBe("敵から味方へ");
  });

  it("deleting the creative knowledge removes its links to works", async () => {
    const { ck, hero } = await setup();
    await createLink(db, { source: { kind: "ck", id: ck.id }, target: { kind: "character", id: hero.id } });
    await deleteCreativeKnowledge(db, ck.id);
    expect(await db.creativeLink.count()).toBe(0);
    expect(await db.character.count()).toBe(1);
  });
});

describe("creative knowledge AI context", () => {
  it("summarizes general knowledge and my note separately, with relations and usage in the project", async () => {
    const { ck, p, hero } = await setup();
    await setCkMyNote(db, ck.id, "単純な改心にはしない");
    await createLink(db, { source: { kind: "ck", id: ck.id }, target: { kind: "character", id: hero.id }, purpose: "改心" });
    const [c] = await ckAiContext(db, [ck.id], { projectId: p.id });
    expect(c).toMatchObject({ title: "敵から味方へ", category: "トロープ・定番", effects: ["意外性", "人間関係の変化"], usage: ["敵対の理由を先に描く"], myNote: "単純な改心にはしない" });
    expect(c.relations).toEqual(["上位の知識：人物の変化"]);
    expect(c.usedInProject).toEqual(["人物：ミナ（改心）"]);

    const inProject = await projectCkContext(db, p.id);
    expect(inProject.map((x) => x.title)).toEqual(["敵から味方へ"]);
    const found = await searchCkForAi(db, "味方");
    expect(found[0]?.title).toBe("敵から味方へ");
  });

  it("AI editor tools return creative knowledge and remember it as a source", async () => {
    const { ck, p, hero } = await setup();
    await createLink(db, { source: { kind: "ck", id: ck.id }, target: { kind: "character", id: hero.id } });
    const refs: CreativeRefs = new Map();
    const sources = { books: new Map(), quotes: new Map(), knowledge: new Map() };
    const searched = JSON.parse(await runCreativeTool(db, "search_creative_knowledge", { query: "敵から味方" }, p.id, refs, sources));
    expect(searched.creativeKnowledge[0].title).toBe("敵から味方へ");
    expect(refs.get(`ck:${ck.id}`)?.href).toBe(`/creative/knowledge/${ck.id}`);
    const listed = JSON.parse(await runCreativeTool(db, "list_project_references", {}, p.id, refs, sources));
    expect(listed.creativeKnowledge.map((x: { title: string }) => x.title)).toEqual(["敵から味方へ"]);
    const character = JSON.parse(await runCreativeTool(db, "get_character", { character_id: hero.id }, p.id, refs, sources));
    expect(character.references[0].creativeKnowledge).toBe("敵から味方へ");
  });
});
