import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createBook, upsertAuthors } from "@/server/services/books";
import { applyAuthorNameCleanup, planAuthorNameCleanup, updateAuthor } from "@/server/services/authors";
import { findSpacedForm, isUnspacedJapaneseName, normalizeAuthorList, normalizeAuthorName } from "@/lib/author-name";

beforeEach(resetDb);

describe("author name helpers", () => {
  it("unifies spaces to a single half-width space", () => {
    expect(normalizeAuthorName("伊坂　幸太郎")).toBe("伊坂 幸太郎");
    expect(normalizeAuthorName("  辻村 　深月 ")).toBe("辻村 深月");
    expect(normalizeAuthorName("Andy Weir")).toBe("Andy Weir");
  });

  it("finds the spaced form only for the same person, and leaves unknown splits alone", () => {
    expect(isUnspacedJapaneseName("夏目漱石")).toBe(true);
    expect(isUnspacedJapaneseName("アンディ・ウィアー")).toBe(false);
    expect(isUnspacedJapaneseName("Andy Weir")).toBe(false);
    expect(findSpacedForm("原田マハ", ["原田 マハ", "森 絵都"])).toBe("原田 マハ");
    expect(findSpacedForm("原田マハ", ["原田 ハマ"])).toBeNull();
    expect(normalizeAuthorList(["夏目漱石", "夏目　漱石", "乙一"], ["夏目 漱石"])).toEqual(["夏目 漱石", "乙一"]);
  });
});

describe("author registration", () => {
  it("normalizes spaces and treats names that differ only by spaces as the same author", async () => {
    const [a] = await upsertAuthors(db, ["辻村　深月"]);
    expect((await db.author.findUniqueOrThrow({ where: { id: a } })).name).toBe("辻村 深月");
    // スペースなしで登録しても同じ著者
    expect(await upsertAuthors(db, ["辻村深月"])).toEqual([a]);
    // スペースなしで先に登録されていたら、スペースありの表記に直して使う
    const [b] = await upsertAuthors(db, ["原田マハ"]);
    expect(await upsertAuthors(db, ["原田 マハ"])).toEqual([b]);
    expect((await db.author.findUniqueOrThrow({ where: { id: b } })).name).toBe("原田 マハ");
    // 同じ本に表記違いで2回渡されても、1人として扱う
    const book = await createBook(db, { title: "テスト", authors: ["森 絵都", "森絵都"] });
    expect(await db.bookAuthor.count({ where: { bookId: book.id } })).toBe(1);
    expect(await db.author.count()).toBe(3);
  });

  it("normalizes spaces when an author is renamed by hand", async () => {
    const [a] = await upsertAuthors(db, ["伊坂幸太郎"]);
    await updateAuthor(db, a, { name: "伊坂　幸太郎" });
    expect((await db.author.findUniqueOrThrow({ where: { id: a } })).name).toBe("伊坂 幸太郎");
  });
});

describe("cleaning up existing author names", () => {
  async function seed() {
    // 表記違いで別の著者として登録されてしまったデータを直接作る
    const mk = (name: string) => db.author.create({ data: { name } });
    const a1 = await mk("辻村 深月");
    const a2 = await mk("辻村　深月");
    const a3 = await mk("辻村深月");
    const b1 = await mk("伊坂　幸太郎");
    const c1 = await mk("原田マハ");
    const d1 = await mk("乙一");
    const e1 = await mk("アンディ・ウィアー");
    const book = (title: string, isbn13?: string) => db.book.create({ data: { title, isbn13 } });
    const [k1, k2, k3, k4, k5] = await Promise.all([book("凍りのくじら"), book("かがみの孤城"), book("ゴールデンスランバー"), book("楽園のカンヴァス", "9784101259611"), book("GOTH")]);
    await db.bookAuthor.createMany({
      data: [
        { bookId: k1.id, authorId: a1.id },
        { bookId: k2.id, authorId: a2.id },
        { bookId: k2.id, authorId: a3.id },
        { bookId: k3.id, authorId: b1.id },
        { bookId: k4.id, authorId: c1.id },
        { bookId: k5.id, authorId: d1.id },
      ],
    });
    return { a1, a2, a3, b1, c1, d1, e1, k2 };
  }

  it("plans renames and merges without writing, using NDL for unknown splits", async () => {
    const { a1, a2, a3, c1, d1 } = await seed();
    const lookups: string[] = [];
    const plan = await planAuthorNameCleanup(db, {
      lookupNdl: async (isbn) => {
        lookups.push(isbn);
        return isbn === "9784101259611" ? ["原田 マハ"] : [];
      },
    });
    const byFrom = Object.fromEntries(plan.changes.map((c) => [c.from, c]));
    expect(byFrom["辻村　深月"]).toMatchObject({ kind: "merge", to: "辻村 深月", intoId: a1.id });
    expect(byFrom["辻村深月"]).toMatchObject({ kind: "merge", to: "辻村 深月", intoId: a1.id });
    expect(byFrom["伊坂　幸太郎"]).toMatchObject({ kind: "rename", to: "伊坂 幸太郎" });
    expect(byFrom["原田マハ"]).toMatchObject({ kind: "rename", to: "原田 マハ", reason: "国立国会図書館の表記に合わせる" });
    expect(byFrom["辻村 深月"]).toBeUndefined();
    expect(byFrom["アンディ・ウィアー"]).toBeUndefined();
    // 区切りがわからない名前はそのまま（一覧で知らせる）
    expect(plan.unresolved.map((u) => u.name)).toEqual(["乙一"]);
    // 既存の表記で解決できた名前は NDL に問い合わせない
    expect(lookups).toEqual(["9784101259611"]);
    // まだ何も書き換えていない
    expect(await db.author.count()).toBe(7);
    void [a2, a3, c1, d1];
  });

  it("applies the plan: renames, merges book links, and keeps every book's authors", async () => {
    const { a1, k2 } = await seed();
    const plan = await planAuthorNameCleanup(db, { lookupNdl: async () => ["原田 マハ"] });
    expect(await applyAuthorNameCleanup(db, plan.changes)).toEqual({ renamed: 2, merged: 2 });
    const names = (await db.author.findMany({ orderBy: { name: "asc" } })).map((a) => a.name);
    expect(names.sort()).toEqual(["アンディ・ウィアー", "乙一", "伊坂 幸太郎", "原田 マハ", "辻村 深月"].sort());
    // 2つの表記で同じ本についていた著者は、1つにまとまる
    expect(await db.bookAuthor.findMany({ where: { bookId: k2.id } })).toEqual([expect.objectContaining({ authorId: a1.id })]);
    expect(await db.bookAuthor.count({ where: { authorId: a1.id } })).toBe(2);
    // もう一度計画しても変更はない
    expect((await planAuthorNameCleanup(db)).changes).toEqual([]);
  });
});
