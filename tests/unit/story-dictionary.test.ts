import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { CK_SEEDS } from "@/server/data/creative-knowledge-seed";
import { CK_DICTIONARY } from "@/server/data/ck-seed/dictionary";
import { syncCkSeeds } from "@/server/services/creative-knowledge-seed";
import { searchCreativeKnowledge } from "@/server/services/creative-knowledge-search";
import { createCreativeKnowledge, updateCreativeKnowledge } from "@/server/services/creative-knowledge";
import { kanaRow, lines, parseExample } from "@/lib/creative-knowledge";

beforeEach(resetDb);

describe("story dictionary helpers", () => {
  it("finds the kana row from the reading (katakana, voiced and small kana too)", () => {
    expect(kanaRow("てきからみかたへ")).toBe("た");
    expect(kanaRow("ガラス")).toBe("か");
    expect(kanaRow("ぎせい")).toBe("か");
    expect(kanaRow("ぱんどら")).toBe("は");
    expect(kanaRow("ゃ")).toBe("や");
    expect(kanaRow("んー")).toBe("わ");
    expect(kanaRow("SF")).toBe("英数");
    expect(kanaRow("")).toBe("他");
    expect(kanaRow("伏線")).toBe("他");
  });

  it("splits an example line into the work and the note", () => {
    expect(parseExample("『竹取物語』：かぐや姫が月へ帰る")).toEqual({ work: "『竹取物語』", note: "かぐや姫が月へ帰る" });
    expect(parseExample("『こころ』（夏目漱石）: 先生の告白")).toEqual({ work: "『こころ』（夏目漱石）", note: "先生の告白" });
    expect(parseExample("ギリシア神話")).toEqual({ work: "ギリシア神話", note: "" });
  });
});

describe("story dictionary data", () => {
  it("gives every sample a hiragana reading and well-formed examples", () => {
    for (const s of CK_SEEDS) {
      const d = CK_DICTIONARY[s.slug];
      expect(d, s.slug).toBeTruthy();
      expect(d.reading, s.slug).toMatch(/^[ぁ-ゖー・]+$/);
      for (const line of d.examples ?? []) {
        const { work, note } = parseExample(line);
        expect(work.length, line).toBeGreaterThan(1);
        // ジャンルの例などは作品名だけでもよい。「：」があるときは説明を書く
        if (/[：:]/.test(line)) expect(note.length, line).toBeGreaterThan(4);
      }
    }
    // 事典に載っていない slug がない（タイプミスの検出）
    const slugs = new Set(CK_SEEDS.map((s) => s.slug));
    expect(Object.keys(CK_DICTIONARY).filter((k) => !slugs.has(k))).toEqual([]);
    // 作品例のある項目が十分ある
    expect(CK_SEEDS.filter((s) => CK_DICTIONARY[s.slug].examples?.length).length).toBeGreaterThan(200);
  });

  it("loads readings and examples with the samples, and finds items by reading or by work title", async () => {
    await syncCkSeeds(db);
    const parting = await db.creativeKnowledge.findUniqueOrThrow({ where: { slug: "parting" } });
    expect(parting.reading).toBe("べつり");
    expect(lines(parting.examples)[0]).toContain("『竹取物語』");
    expect((await searchCreativeKnowledge(db, "てきからみかたへ"))[0]?.item.title).toBe("敵から味方へ");
    const byWork = (await searchCreativeKnowledge(db, "竹取物語")).map((h) => h.item.title);
    expect(byWork).toEqual(expect.arrayContaining(["別離", "月"]));
  });

  it("keeps reading and examples a user wrote", async () => {
    const k = await createCreativeKnowledge(db, { title: "自作の要素", category: "MOTIF", reading: "じさくのようそ", examples: "『自作』：試し" });
    await updateCreativeKnowledge(db, k.id, { title: "自作の要素", category: "MOTIF", reading: "じさく", examples: "『自作』：書き直し" });
    const got = await db.creativeKnowledge.findUniqueOrThrow({ where: { id: k.id } });
    expect([got.reading, got.examples]).toEqual(["じさく", "『自作』：書き直し"]);
  });
});
