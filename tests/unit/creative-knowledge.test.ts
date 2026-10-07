import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import {
  ckCategoryCounts,
  createCreativeKnowledge,
  deleteCreativeKnowledge,
  getCreativeKnowledge,
  listCreativeKnowledge,
  updateCreativeKnowledge,
} from "@/server/services/creative-knowledge";
import { createProject } from "@/server/services/novels";
import { exportJson, runImport, deleteAllData } from "@/server/services/backup";
import { lines } from "@/lib/creative-knowledge";

beforeEach(resetDb);

const base = {
  title: "敵から味方へ",
  category: "TROPE" as const,
  extraCategories: ["CHARACTER", "PLOT", "TROPE"] as ("CHARACTER" | "PLOT" | "TROPE")[],
  subCategory: "敵から味方へ",
  summary: "主人公と敵対していた人物が、物語の途中で主人公側に加わる展開。",
  effects: "意外性\n人間関係の変化\n・キャラクターの成長",
  flow: "敵対\n疑念\n共闘\n信頼",
  aliases: "敵が仲間になる\n寝返り",
  tags: ["成長", "裏切り"],
};

describe("creative knowledge CRUD", () => {
  it("creates with extra categories and tags, and reads it back", async () => {
    const k = await createCreativeKnowledge(db, base);
    const got = await getCreativeKnowledge(db, k.id);
    expect(got?.title).toBe("敵から味方へ");
    expect(got?.origin).toBe("user");
    // 主カテゴリと同じものは2つ目以降のカテゴリに入れない
    expect(got?.categories.map((c) => c.category).sort()).toEqual(["CHARACTER", "PLOT"]);
    expect(got?.tags.map((t) => t.tag.name).sort()).toEqual(["成長", "裏切り"]);
    expect(lines(got!.effects)).toEqual(["意外性", "人間関係の変化", "キャラクターの成長"]);
  });

  it("validates required fields", async () => {
    await expect(createCreativeKnowledge(db, { ...base, title: "  " })).rejects.toThrow();
    await expect(createCreativeKnowledge(db, { ...base, category: "NOPE" as "TROPE" })).rejects.toThrow();
  });

  it("updates fields, replaces categories/tags, and cleans up unused tags", async () => {
    const k = await createCreativeKnowledge(db, base);
    await updateCreativeKnowledge(db, k.id, { ...base, title: "敵から味方へ（改）", extraCategories: ["EMOTION"], tags: ["贖罪"] });
    const got = await getCreativeKnowledge(db, k.id);
    expect(got?.title).toBe("敵から味方へ（改）");
    expect(got?.categories.map((c) => c.category)).toEqual(["EMOTION"]);
    expect(got?.tags.map((t) => t.tag.name)).toEqual(["贖罪"]);
    expect(await db.tag.count({ where: { name: "裏切り" } })).toBe(0);
    expect(got?.userEdited).toBe(false);
  });

  it("marks seed knowledge as edited by the user", async () => {
    const k = await createCreativeKnowledge(db, base, { slug: "enemy-to-ally", origin: "seed" });
    await updateCreativeKnowledge(db, k.id, { ...base, myNote: undefined } as typeof base);
    expect((await getCreativeKnowledge(db, k.id))?.userEdited).toBe(true);
  });

  it("deletes knowledge with its links to works", async () => {
    const k = await createCreativeKnowledge(db, base);
    const p = await createProject(db, { title: "灯台の物語" });
    await db.creativeLink.create({ data: { ckId: k.id, projectId: p.id } });
    await deleteCreativeKnowledge(db, k.id);
    expect(await getCreativeKnowledge(db, k.id)).toBeNull();
    expect(await db.creativeLink.count({ where: { ckId: k.id } })).toBe(0);
    expect(await db.novelProject.count()).toBe(1);
    expect(await db.tag.count()).toBe(0);
  });

  it("lists by category (including extra categories), tag and text, and counts per category", async () => {
    await createCreativeKnowledge(db, base);
    await createCreativeKnowledge(db, { title: "伏線回収", category: "PLOT", summary: "前に張った伏線を後で明かす", tags: ["伏線"] });
    expect((await listCreativeKnowledge(db, { category: "CHARACTER" })).map((k) => k.title)).toEqual(["敵から味方へ"]);
    expect((await listCreativeKnowledge(db, { category: "PLOT" })).map((k) => k.title).sort()).toEqual(["伏線回収", "敵から味方へ"].sort());
    expect((await listCreativeKnowledge(db, { tag: "伏線" })).map((k) => k.title)).toEqual(["伏線回収"]);
    expect((await listCreativeKnowledge(db, { q: "仲間になる" })).map((k) => k.title)).toEqual(["敵から味方へ"]);
    const counts = await ckCategoryCounts(db);
    expect(counts).toMatchObject({ TROPE: 1, PLOT: 2, CHARACTER: 1, STRUCTURE: 0 });
  });
});

describe("creative knowledge in backups", () => {
  it("is exported, deleted with all data, and restored from JSON", async () => {
    const k = await createCreativeKnowledge(db, base, { slug: "enemy-to-ally", origin: "seed" });
    const p = await createProject(db, { title: "灯台の物語" });
    await db.creativeLink.create({ data: { ckId: k.id, projectId: p.id } });
    const json = JSON.stringify(await exportJson(db));
    await deleteAllData(db);
    expect(await db.creativeKnowledge.count()).toBe(0);
    const created = await runImport(db, json);
    expect(created.creativeKnowledge).toBe(1);
    const restored = await db.creativeKnowledge.findFirstOrThrow({ include: { categories: true, tags: true } });
    expect(restored.slug).toBe("enemy-to-ally");
    expect(restored.categories).toHaveLength(2);
    expect(restored.tags).toHaveLength(2);
    expect(await db.creativeLink.count({ where: { ckId: restored.id } })).toBe(1);
    // 2回目の取り込みでは重複を作らない
    await runImport(db, json);
    expect(await db.creativeKnowledge.count()).toBe(1);
  });
});

describe("creative knowledge categories and tags", () => {
  it("lists tags with counts and subcategories within a category", async () => {
    const { ckTags, ckSubCategories } = await import("@/server/services/creative-knowledge");
    await createCreativeKnowledge(db, { ...base, title: "a", subCategory: "敵から味方へ", tags: ["成長", "裏切り"] });
    await createCreativeKnowledge(db, { ...base, title: "b", subCategory: "敵から味方へ", tags: ["成長"] });
    await createCreativeKnowledge(db, { ...base, title: "c", subCategory: "共通の敵", tags: [] });
    await createCreativeKnowledge(db, { ...base, title: "d", category: "PLOT", subCategory: "伏線", tags: ["成長"] });
    expect(await ckTags(db)).toEqual([
      { name: "成長", count: 3 },
      { name: "裏切り", count: 1 },
    ]);
    expect(await ckSubCategories(db, "TROPE")).toEqual([
      { name: "敵から味方へ", count: 2 },
      { name: "共通の敵", count: 1 },
    ]);
    expect((await listCreativeKnowledge(db, { category: "TROPE", sub: "共通の敵" })).map((k) => k.title)).toEqual(["c"]);
    // タグを付けた知識が消えると、タグ一覧からも消える
    const d = await db.creativeKnowledge.findFirstOrThrow({ where: { title: "d" } });
    await deleteCreativeKnowledge(db, d.id);
    expect((await ckTags(db)).find((t) => t.name === "成長")?.count).toBe(2);
  });
});
