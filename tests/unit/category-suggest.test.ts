import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createBook } from "@/server/services/books";
import { createQuote } from "@/server/services/quotes";
import { createKnowledge } from "@/server/services/knowledge";
import { suggestCategoriesByRules } from "@/server/services/category-suggest";

beforeEach(resetDb);

describe("knowledge category suggestions", () => {
  it("prefers the category of knowledge from the same book", async () => {
    const book = await createBook(db, { title: "国富論" });
    await createKnowledge(db, { title: "分業", category: "経済学", bookIds: [book.id] });
    await createKnowledge(db, { title: "ストア派", category: "哲学" });
    const r = await suggestCategoriesByRules(db, { title: "見えざる手", bookIds: [book.id] });
    expect(r[0]).toMatchObject({ name: "経済学", existing: true });
    expect(r[0].reason).toContain("同じ本");
  });

  it("uses the same quote, tags and similar content", async () => {
    const q = await createQuote(db, { text: "自分にできることに集中せよ" });
    await createKnowledge(db, { title: "コントロールの二分法", content: "自分で変えられることと変えられないことを区別する", category: "哲学", quoteIds: [q.id] });
    expect((await suggestCategoriesByRules(db, { title: "x", quoteIds: [q.id] }))[0].name).toBe("哲学");
    expect((await suggestCategoriesByRules(db, { title: "変えられないことを受け入れる", content: "自分で変えられることと変えられないことを区別する考え方" }))[0].name).toBe("哲学");
  });

  it("maps keywords to an existing similar category instead of creating a new one", async () => {
    await createKnowledge(db, { title: "x", category: "経済学" });
    const r = await suggestCategoriesByRules(db, { title: "インフレと金融政策", content: "景気が良くなると物価が上がる" });
    expect(r.map((s) => s.name)).toContain("経済学");
    expect(r.map((s) => s.name)).not.toContain("経済");
  });

  it("suggests a new category when nothing exists yet, and excludes the note itself", async () => {
    const r = await suggestCategoriesByRules(db, { title: "プログラミングの基本", content: "Pythonでデータ分析" });
    expect(r[0]).toMatchObject({ existing: false });
    const self = await createKnowledge(db, { title: "自分自身", content: "同じ内容の文章です", category: "自己" });
    const r2 = await suggestCategoriesByRules(db, { title: "自分自身", content: "同じ内容の文章です", excludeId: self.id });
    expect(r2.map((s) => s.name)).not.toContain("自己");
  });
});
