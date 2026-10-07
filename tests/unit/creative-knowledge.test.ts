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
  it("orders subcategories as listed for the category, then custom ones, then その他", async () => {
    const { ckSubCategories } = await import("@/server/services/creative-knowledge");
    for (const [title, sub] of [["a", "その他"], ["b", "自作の分類"], ["c", "共通の敵"], ["d", "選ばれし者"], ["e", "自作の分類"]]) {
      await createCreativeKnowledge(db, { ...base, title, subCategory: sub, extraCategories: [] });
    }
    expect((await ckSubCategories(db, "TROPE")).map((s) => s.name)).toEqual(["選ばれし者", "共通の敵", "自作の分類", "その他"]);
  });

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

describe("relations between creative knowledge", () => {
  it("adds typed relations and shows them from both sides with the right wording", async () => {
    const { addCkRelation, ckRelationsOf } = await import("@/server/services/creative-knowledge");
    const foreshadow = await createCreativeKnowledge(db, { title: "伏線", category: "PLOT" });
    const payoff = await createCreativeKnowledge(db, { title: "伏線回収", category: "PLOT" });
    const twist = await createCreativeKnowledge(db, { title: "どんでん返し", category: "PLOT" });
    // 伏線回収から見て、伏線は「上位の知識」
    await addCkRelation(db, { fromId: payoff.id, toId: foreshadow.id, type: "parent", note: "回収には伏線が必要" });
    await addCkRelation(db, { fromId: payoff.id, toId: twist.id, type: "combination" });
    const fromPayoff = await ckRelationsOf(db, payoff.id);
    expect(fromPayoff.map((r) => [r.label, r.other.title])).toEqual([
      ["上位の知識", "伏線"],
      ["組み合わせ", "どんでん返し"],
    ]);
    expect(fromPayoff[0].note).toBe("回収には伏線が必要");
    // 逆側（伏線）から見ると「下位の知識」
    expect((await ckRelationsOf(db, foreshadow.id)).map((r) => [r.label, r.other.title])).toEqual([["下位の知識", "伏線回収"]]);
  });

  it("does not duplicate symmetric relations, rejects self links, and removes on delete", async () => {
    const { addCkRelation, removeCkRelation, ckRelationsOf, pickCreativeKnowledge } = await import("@/server/services/creative-knowledge");
    const a = await createCreativeKnowledge(db, { title: "ライバル", category: "CHARACTER" });
    const b = await createCreativeKnowledge(db, { title: "宿敵", category: "TROPE", aliases: "因縁の相手" });
    await addCkRelation(db, { fromId: a.id, toId: b.id, type: "similar" });
    await addCkRelation(db, { fromId: b.id, toId: a.id, type: "similar" });
    expect(await db.creativeKnowledgeRelation.count()).toBe(1);
    // 向きのある関係は逆向きでも別の関係として持てる
    await addCkRelation(db, { fromId: b.id, toId: a.id, type: "prerequisite" });
    expect(await db.creativeKnowledgeRelation.count()).toBe(2);
    await expect(addCkRelation(db, { fromId: a.id, toId: a.id, type: "related" })).rejects.toThrow();
    // 候補には自分自身を出さない。別名でも探せる
    expect((await pickCreativeKnowledge(db, "", a.id)).map((k) => k.title)).toEqual(["宿敵"]);
    expect((await pickCreativeKnowledge(db, "因縁")).map((k) => k.title)).toEqual(["宿敵"]);
    const rel = (await ckRelationsOf(db, a.id)).find((r) => r.type === "similar")!;
    await removeCkRelation(db, rel.id);
    expect(await db.creativeKnowledgeRelation.count()).toBe(1);
    await deleteCreativeKnowledge(db, b.id);
    expect(await db.creativeKnowledgeRelation.count()).toBe(0);
  });
});

describe("favorites and my notes", () => {
  it("toggles favorites and filters by them", async () => {
    const { toggleCkFavorite } = await import("@/server/services/creative-knowledge");
    const a = await createCreativeKnowledge(db, { ...base, title: "a" });
    await createCreativeKnowledge(db, { ...base, title: "b" });
    expect(await toggleCkFavorite(db, a.id)).toBe(true);
    expect((await listCreativeKnowledge(db, { favorite: true })).map((k) => k.title)).toEqual(["a"]);
    expect(await toggleCkFavorite(db, a.id)).toBe(false);
    expect(await listCreativeKnowledge(db, { favorite: true })).toEqual([]);
    await expect(toggleCkFavorite(db, "missing")).rejects.toThrow();
  });

  it("keeps my note separate from general knowledge", async () => {
    const { setCkMyNote } = await import("@/server/services/creative-knowledge");
    const { searchCreativeKnowledge } = await import("@/server/services/creative-knowledge-search");
    const seed = await createCreativeKnowledge(db, base, { slug: "enemy-to-ally", origin: "seed" });
    await setCkMyNote(db, seed.id, "  自分の小説では、思想の対立を残したまま共闘させたい  ");
    let got = await getCreativeKnowledge(db, seed.id);
    expect(got?.myNote).toBe("自分の小説では、思想の対立を残したまま共闘させたい");
    // 自分のメモはサンプルの「編集」扱いにしない（サンプル更新で上書きしてよい一般の知識とは別）
    expect(got?.userEdited).toBe(false);
    // 一般の知識を更新しても、自分のメモは残る
    await updateCreativeKnowledge(db, seed.id, { ...base, summary: "更新した概要" });
    got = await getCreativeKnowledge(db, seed.id);
    expect(got?.myNote).toContain("思想の対立");
    expect(got?.summary).toBe("更新した概要");
    // 自分のメモの言葉でも検索できる
    expect((await searchCreativeKnowledge(db, "思想の対立", { withRelated: false })).map((h) => h.reason)).toEqual(["自分のメモに一致"]);
    await expect(setCkMyNote(db, seed.id, "あ".repeat(10001))).rejects.toThrow();
  });
});
