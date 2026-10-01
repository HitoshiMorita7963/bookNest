import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { askLibrarian, extractKeywords } from "@/server/ai/librarian";
import { newSources, runLibrarianTool } from "@/server/ai/tools";
import { loadSampleData } from "@/server/services/sample";

beforeEach(async () => {
  await resetDb();
  await loadSampleData(db);
});

describe("AI librarian (no provider configured)", () => {
  it("extracts keywords from Japanese questions", () => {
    expect(extractKeywords("今まで読んだ政治の本を教えて")).toContain("政治");
    expect(extractKeywords("保存したフレーズから人生に関するものを探して")).toEqual(expect.arrayContaining(["フレーズ", "人生"]));
  });

  it("falls back to local search mode with sources and saves the conversation", async () => {
    delete process.env.AI_API_KEY;
    const r = await askLibrarian(db, null, "今まで読んだ政治の本を教えて");
    expect(r.message.mode).toBe("local");
    expect(r.message.content).toContain("AIが未設定");
    expect(r.message.sources.books.map((b) => b.title)).toEqual(expect.arrayContaining(["君主論", "社会契約論"]));
    const conv = await db.aIConversation.findUnique({ where: { id: r.conversationId }, include: { messages: true } });
    expect(conv?.messages).toHaveLength(2);
    // 同じ会話に続けて質問できる
    const r2 = await askLibrarian(db, r.conversationId, "人生に関するフレーズは？");
    expect(r2.conversationId).toBe(r.conversationId);
    expect(r2.message.sources.quotes.length).toBeGreaterThan(0);
  });

  it("rejects empty questions", async () => {
    await expect(askLibrarian(db, null, "  ")).rejects.toThrow();
  });
});

describe("AI tools read only app data and record sources", () => {
  it("list_books / get_book / search_quotes / reading_overview", async () => {
    const src = newSources();
    const list = JSON.parse(await runLibrarianTool(db, "list_books", { genre: "政治" }, src));
    expect(list.books.map((b: { title: string }) => b.title).sort()).toEqual(["君主論", "社会契約論"].sort());
    const id = list.books[0].id;
    const detail = JSON.parse(await runLibrarianTool(db, "get_book", { book_id: id }, src));
    expect(detail.title).toBeTruthy();
    const quotes = JSON.parse(await runLibrarianTool(db, "search_quotes", { tag: "人生" }, src));
    expect(quotes.count).toBeGreaterThan(0);
    const overview = JSON.parse(await runLibrarianTool(db, "reading_overview", { period: "all" }, src));
    expect(overview.completedCount).toBeGreaterThan(0);
    expect(src.books.size).toBeGreaterThan(0);
    expect(src.quotes.size).toBeGreaterThan(0);
    const unknown = JSON.parse(await runLibrarianTool(db, "nope", {}, src));
    expect(unknown.error).toBeTruthy();
  });
});
