import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createCreativeKnowledge } from "@/server/services/creative-knowledge";
import { searchCreativeKnowledge } from "@/server/services/creative-knowledge-search";
import type { CkCategory } from "@/lib/creative-knowledge";

beforeEach(resetDb);

async function k(title: string, category: CkCategory, extra: Partial<Parameters<typeof createCreativeKnowledge>[1]> = {}) {
  return createCreativeKnowledge(db, { title, category, ...extra });
}

async function seed() {
  const enemy = await k("敵から味方へ", "TROPE", {
    summary: "主人公と敵対していた人物が、物語の途中で主人公側に加わる展開。",
    aliases: "敵が仲間になる\n寝返り\n味方になる敵",
    tags: ["成長"],
  });
  const rival = await k("ライバル", "CHARACTER", { summary: "主人公と競い合い、互いを高め合う人物。" });
  const redemption = await k("贖罪", "CHARACTER", { summary: "過去の罪を償おうとする人物の変化。", tags: ["成長"] });
  const common = await k("共通の敵", "TROPE", { summary: "対立していた者同士が、より大きな敵に対して手を組む。" });
  const reconcile = await k("和解", "PLOT", { summary: "対立していた人物同士が理解し合い、関係を修復する。" });
  await k("伏線回収", "PLOT", { summary: "前に張った伏線を後で明かし、驚きと納得を与える。", tags: ["ミステリー"] });
  await k("雨", "MOTIF", { summary: "悲しみや浄化を象徴することが多い。" });
  await k("三幕構成", "STRUCTURE", { summary: "設定・対立・解決の三つに分ける物語構造。" });
  for (const to of [rival, redemption, common, reconcile]) {
    await db.creativeKnowledgeRelation.create({ data: { fromId: enemy.id, toId: to.id, type: to.id === common.id ? "combination" : "related" } });
  }
  return { enemy };
}

describe("creative knowledge search", () => {
  it("finds knowledge by paraphrase (alias) and adds related knowledge", async () => {
    await seed();
    const hits = await searchCreativeKnowledge(db, "敵が仲間になる");
    const titles = hits.map((h) => h.item.title);
    expect(titles[0]).toBe("敵から味方へ");
    expect(hits[0].reason).toContain("別名");
    expect(titles).toEqual(expect.arrayContaining(["ライバル", "贖罪", "共通の敵", "和解"]));
    expect(titles).not.toContain("雨");
    expect(titles).not.toContain("三幕構成");
    expect(hits.find((h) => h.item.title === "ライバル")?.via).toBe("敵から味方へ");
  });

  it("matches titles, tags, category names and words in the description", async () => {
    await seed();
    expect((await searchCreativeKnowledge(db, "伏線"))[0].item.title).toBe("伏線回収");
    expect((await searchCreativeKnowledge(db, "ミステリー", { withRelated: false })).map((h) => h.item.title)).toEqual(["伏線回収"]);
    expect((await searchCreativeKnowledge(db, "モチーフ", { withRelated: false })).map((h) => h.item.title)).toEqual(["雨"]);
    expect((await searchCreativeKnowledge(db, "大きな敵", { withRelated: false }))[0].item.title).toBe("共通の敵");
  });

  it("ranks exact title matches first and respects filters", async () => {
    await seed();
    expect((await searchCreativeKnowledge(db, "和解"))[0].item.title).toBe("和解");
    const onlyCharacter = await searchCreativeKnowledge(db, "敵が仲間になる", { category: "CHARACTER" });
    expect(onlyCharacter.every((h) => h.item.category === "CHARACTER")).toBe(true);
    expect((await searchCreativeKnowledge(db, "成長", { tag: "成長", withRelated: false })).map((h) => h.item.title).sort()).toEqual(["敵から味方へ", "贖罪"].sort());
  });

  it("returns nothing for empty or unrelated queries", async () => {
    await seed();
    expect(await searchCreativeKnowledge(db, "  ")).toEqual([]);
    expect(await searchCreativeKnowledge(db, "量子コンピューター")).toEqual([]);
  });
});
