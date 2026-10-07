import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { CK_SEEDS } from "@/server/data/creative-knowledge-seed";
import { ckSeedStatus, syncCkSeeds } from "@/server/services/creative-knowledge-seed";
import { ckRelationsOf, deleteCreativeKnowledge, setCkMyNote, toggleCkFavorite, updateCreativeKnowledge } from "@/server/services/creative-knowledge";
import { searchCreativeKnowledge } from "@/server/services/creative-knowledge-search";
import { creativeKnowledgeInputSchema } from "@/lib/validators";
import { CK_CATEGORIES } from "@/lib/creative-knowledge";

beforeEach(resetDb);

describe("creative knowledge seed data", () => {
  it("is valid: unique slugs/titles, every category covered, relation targets exist, no duplicated pairs", () => {
    const slugs = new Set(CK_SEEDS.map((s) => s.slug));
    expect(slugs.size).toBe(CK_SEEDS.length);
    expect(new Set(CK_SEEDS.map((s) => s.title)).size).toBe(CK_SEEDS.length);
    // 目安：全体で200〜250件、各カテゴリ15件以上
    expect(CK_SEEDS.length).toBeGreaterThanOrEqual(200);
    expect(CK_SEEDS.length).toBeLessThanOrEqual(250);
    for (const c of CK_CATEGORIES) expect(CK_SEEDS.filter((s) => s.category === c).length, c).toBeGreaterThanOrEqual(15);
    const pairs = new Set<string>();
    for (const s of CK_SEEDS) {
      expect(s.summary.length, s.slug).toBeGreaterThan(10);
      for (const [, to] of s.relations ?? []) {
        expect(slugs.has(to), `${s.slug} → ${to}`).toBe(true);
        expect(to).not.toBe(s.slug);
        // 同じ2つの知識の間には、どちらの向きからも関係を1つだけ書く（両方から書くと詳細画面に2回出る）
        const key = [s.slug, to].sort().join("|");
        expect(pairs.has(key), key).toBe(false);
        pairs.add(key);
      }
    }
  });

  it("passes the same validation as the form", () => {
    for (const s of CK_SEEDS) {
      const r = creativeKnowledgeInputSchema.safeParse({ title: s.title, category: s.category, extraCategories: s.extraCategories ?? [], summary: s.summary, tags: s.tags ?? [] });
      expect(r.success, s.slug).toBe(true);
    }
  });

  it("loads once, is idempotent, and links relations", async () => {
    expect(await ckSeedStatus(db)).toMatchObject({ total: CK_SEEDS.length, missing: CK_SEEDS.length, outdated: 0 });
    const first = await syncCkSeeds(db);
    expect(first).toMatchObject({ created: CK_SEEDS.length, updated: 0, skipped: 0, remaining: 0 });
    expect(first.linked).toBeGreaterThan(100);
    expect(await ckSeedStatus(db)).toMatchObject({ missing: 0, outdated: 0, edited: 0 });
    const again = await syncCkSeeds(db);
    expect(again).toEqual({ created: 0, updated: 0, skipped: 0, remaining: 0, linked: 0 });
    expect(await db.creativeKnowledge.count()).toBe(CK_SEEDS.length);
    expect(await db.creativeKnowledge.count({ where: { origin: "seed" } })).toBe(CK_SEEDS.length);

    const enemy = await db.creativeKnowledge.findUniqueOrThrow({ where: { slug: "enemy-to-ally" } });
    const rel = await ckRelationsOf(db, enemy.id);
    expect(rel.map((r) => `${r.label}:${r.other.title}`)).toContain("組み合わせ:共通の敵");
    const relCount = await db.creativeKnowledgeRelation.count();
    await syncCkSeeds(db);
    expect(await db.creativeKnowledgeRelation.count()).toBe(relCount);

    // 言い換えで見つかる
    const hits = await searchCreativeKnowledge(db, "敵が仲間になる");
    expect(hits[0]?.item.title).toBe("敵から味方へ");
  });

  it("updates untouched samples, but never overwrites user edits, favorites or my note", async () => {
    await syncCkSeeds(db);
    const a = await db.creativeKnowledge.findUniqueOrThrow({ where: { slug: "foreshadowing" } });
    const b = await db.creativeKnowledge.findUniqueOrThrow({ where: { slug: "payoff" } });
    // a：サンプルの内容が古くなった（自分では編集していない）
    await db.creativeKnowledge.update({ where: { id: a.id }, data: { summary: "古い説明" } });
    await toggleCkFavorite(db, a.id);
    await setCkMyNote(db, a.id, "自分の作品では3章で使う");
    // b：自分で編集した
    await updateCreativeKnowledge(db, b.id, { title: "伏線回収（自分用）", category: "PLOT", summary: "自分の言葉で書き直した" });
    expect(await ckSeedStatus(db)).toMatchObject({ missing: 0, outdated: 1, edited: 1 });

    expect(await syncCkSeeds(db)).toMatchObject({ created: 0, updated: 1, skipped: 1, remaining: 0 });
    const a2 = await db.creativeKnowledge.findUniqueOrThrow({ where: { id: a.id } });
    expect(a2.summary).toBe(CK_SEEDS.find((s) => s.slug === "foreshadowing")!.summary);
    expect(a2.isFavorite).toBe(true);
    expect(a2.myNote).toBe("自分の作品では3章で使う");
    expect(a2.userEdited).toBe(false);
    const b2 = await db.creativeKnowledge.findUniqueOrThrow({ where: { id: b.id } });
    expect(b2.title).toBe("伏線回収（自分用）");
    expect(b2.userEdited).toBe(true);
  });

  it("loads in batches (for the production time limit) and links relations only at the end", async () => {
    const r1 = await syncCkSeeds(db, { limit: 100 });
    expect(r1).toMatchObject({ created: 100, remaining: CK_SEEDS.length - 100, linked: 0 });
    expect(await db.creativeKnowledgeRelation.count()).toBe(0);
    let r = r1;
    while (r.remaining > 0) r = await syncCkSeeds(db, { limit: 100 });
    expect(await db.creativeKnowledge.count()).toBe(CK_SEEDS.length);
    expect(r.linked).toBeGreaterThan(100);
    expect(await ckSeedStatus(db)).toMatchObject({ missing: 0, outdated: 0 });
  });

  it("does not bring back samples the user deleted", async () => {
    await syncCkSeeds(db);
    const rain = await db.creativeKnowledge.findUniqueOrThrow({ where: { slug: "rain-motif" } });
    await deleteCreativeKnowledge(db, rain.id);
    expect(await ckSeedStatus(db)).toMatchObject({ missing: 0, outdated: 0, deleted: 1 });
    expect(await syncCkSeeds(db)).toMatchObject({ created: 0, skipped: 1 });
    expect(await db.creativeKnowledge.count({ where: { slug: "rain-motif" } })).toBe(0);
    // 自分で作った知識を消しても、記録には残さない
    const mine = await db.creativeKnowledge.create({ data: { title: "自作", category: "MOTIF" } });
    await deleteCreativeKnowledge(db, mine.id);
    expect(await ckSeedStatus(db)).toMatchObject({ deleted: 1 });
    // 「すべてのデータを削除」の後は、もう一度すべて読み込める
    const { deleteAllData } = await import("@/server/services/backup");
    await deleteAllData(db);
    expect(await ckSeedStatus(db)).toMatchObject({ missing: CK_SEEDS.length, deleted: 0 });
  });
});
