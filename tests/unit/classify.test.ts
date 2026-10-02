import { describe, expect, it } from "vitest";
import { classifyByRules, genreFromNdc } from "@/lib/classify";

describe("genre from NDC", () => {
  it("maps literature, business, IT and others", () => {
    expect(genreFromNdc("913.6")).toBe("小説");
    expect(genreFromNdc("933.7")).toBe("小説");
    expect(genreFromNdc("914.6")).toBe("エッセイ");
    expect(genreFromNdc("336.2")).toBe("ビジネス書");
    expect(genreFromNdc("007.13")).toBe("IT・テクノロジー");
    expect(genreFromNdc("159")).toBe("自己啓発");
    expect(genreFromNdc("596")).toBe("実用・暮らし");
    expect(genreFromNdc("291.09")).toBe("旅行");
    expect(genreFromNdc("726.1")).toBe("漫画");
    expect(genreFromNdc(null)).toBeNull();
  });
});

describe("classifyByRules", () => {
  it("tags novels by their content", () => {
    const r = classifyByRules({ title: "猫と探偵", description: "密室で起きた殺人事件。飼い猫だけが真相を知っている。", ndc: "913.6" });
    expect(r.genre).toBe("小説");
    expect(r.tags).toEqual(expect.arrayContaining(["ミステリー", "動物"]));
  });

  it("falls back to ヒューマンドラマ for novels without clues", () => {
    expect(classifyByRules({ title: "ある一日", ndc: "913.6" }).tags).toEqual(["ヒューマンドラマ"]);
  });

  it("puts non-fiction in 新書 labels into 新書 with 教養", () => {
    const r = classifyByRules({ title: "検証 政治改革", seriesTitle: "岩波新書 新赤版", ndc: "312.1" });
    expect(r.genre).toBe("新書");
    expect(r.tags).toEqual(expect.arrayContaining(["政治", "教養"]));
  });

  it("keeps novels in ノベルス as 小説", () => {
    expect(classifyByRules({ title: "館の殺人", seriesTitle: "講談社ノベルス", ndc: "913.6" }).genre).toBe("小説");
  });

  it("guesses without NDC from keywords", () => {
    const r = classifyByRules({ title: "はじめてのPythonプログラミング", description: "データ分析とAIの基礎" });
    expect(r.genre).toBe("IT・テクノロジー");
    expect(r.tags).toEqual(expect.arrayContaining(["AI", "IT"]));
    expect(r.tags.length).toBeLessThanOrEqual(4);
  });
});
