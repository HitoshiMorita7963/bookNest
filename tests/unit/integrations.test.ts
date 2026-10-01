import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, resetDb } from "./helpers";
import { createBook } from "@/server/services/books";
import { createQuote, deleteQuote } from "@/server/services/quotes";
import { createKnowledge } from "@/server/services/knowledge";
import { createCreativeNote, createLink } from "@/server/services/creative";
import { createProject } from "@/server/services/novels";
import { SHEETS, syncAll, syncItems, type SheetsPayload } from "@/server/services/sheets";
import { fillMissingCovers } from "@/server/services/covers";
import { rakutenCover, rakutenProvider } from "@/server/services/metadata";
import { aiConfig, normalizeModel, normalizeProvider } from "@/server/ai/config";

beforeEach(resetDb);

function recorder() {
  const sent: SheetsPayload[] = [];
  return { sent, send: async (p: SheetsPayload) => void sent.push(p) };
}

describe("spreadsheet sync", () => {
  it("builds rows with the decided columns and upserts / deletes by ID", async () => {
    const book = await createBook(db, { title: "灯台へ", authors: ["ヴァージニア・ウルフ"] });
    const q = await createQuote(db, { text: "=人は誰でも孤独な灯台だ", bookId: book.id, pageNumber: "42", tags: ["孤独"] });
    const { sent, send } = recorder();
    await syncItems(db, "quote", [q.id], send);
    expect(sent).toHaveLength(1);
    const p = sent[0] as Extract<SheetsPayload, { action: "upsert" }>;
    expect(p.action).toBe("upsert");
    expect(p.sheet).toBe("フレーズ");
    expect(p.headers).toEqual(SHEETS.quote.headers);
    const row = p.rows[0];
    expect(row[0]).toBe(q.id);
    // 数式として解釈されないようにする
    expect(row[1]).toBe("'=人は誰でも孤独な灯台だ");
    expect(row.slice(2, 5)).toEqual(["灯台へ", "ヴァージニア・ウルフ", "42"]);
    expect(row[6]).toBe("孤独");
    expect(row).toHaveLength(SHEETS.quote.headers.length);

    // 削除済みの ID は行の削除として送る
    await deleteQuote(db, q.id);
    await syncItems(db, "quote", [q.id], send);
    expect(sent[1]).toMatchObject({ action: "delete", sheet: "フレーズ", ids: [q.id] });
  });

  it("creative note rows include source materials and the works that use them", async () => {
    const book = await createBook(db, { title: "灯台へ" });
    const p = await createProject(db, { title: "灯台の物語" });
    const note = await createCreativeNote(db, { title: "灯台のモチーフ", category: "MOTIF" });
    await createLink(db, { source: { kind: "book", id: book.id }, target: { kind: "note", id: note.id } });
    await createLink(db, { source: { kind: "note", id: note.id }, target: { kind: "project", id: p.id } });
    const { sent, send } = recorder();
    await syncItems(db, "note", [note.id], send);
    const row = (sent[0] as Extract<SheetsPayload, { action: "upsert" }>).rows[0];
    expect(row[1]).toBe("灯台のモチーフ");
    expect(row[3]).toBe("モチーフ");
    expect(row[4]).toBe("使用中");
    expect(row[6]).toContain("灯台へ");
    expect(row[7]).toContain("灯台の物語");
  });

  it("full sync replaces all three sheets", async () => {
    await createQuote(db, { text: "a" });
    await createKnowledge(db, { title: "k" });
    const { sent, send } = recorder();
    const counts = await syncAll(db, send);
    expect(counts).toEqual({ quote: 1, knowledge: 1, note: 0 });
    expect(sent.map((s) => (s.action === "replace" ? s.sheet : ""))).toEqual(["フレーズ", "知識", "創作メモ"]);
  });
});

describe("cover bulk fetch", () => {
  it("fills only missing covers and skips books already tried", async () => {
    const a = await createBook(db, { title: "A", isbn: "9784101010014" });
    const b = await createBook(db, { title: "B", isbn: "9784003101018" });
    await createBook(db, { title: "C", isbn: "9784062748681", coverImage: "https://example.com/c.jpg" });
    await createBook(db, { title: "No ISBN" });
    const find = vi.fn(async (isbn: string) => (isbn === "9784101010014" ? "https://example.com/a.jpg" : null));
    const r = await fillMissingCovers(db, { find });
    expect(find).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ processed: 2, found: 1, notFoundIds: [b.id], remaining: 0 });
    expect((await db.book.findUniqueOrThrow({ where: { id: a.id } })).coverImage).toBe("https://example.com/a.jpg");
    const again = await fillMissingCovers(db, { find, skipIds: [b.id] });
    expect(again.processed).toBe(0);
  });
});

describe("Rakuten Books provider", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it("enlarges images and ignores the no-image placeholder", () => {
    expect(rakutenCover("http://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/0014/9784101010014.jpg?_ex=200x200")).toBe(
      "https://thumbnail.image.rakuten.co.jp/@0_mall/book/cabinet/0014/9784101010014.jpg?_ex=400x400",
    );
    expect(rakutenCover("https://thumbnail.image.rakuten.co.jp/0_mall/book/cabinet/noimage_01.gif?_ex=200x200")).toBeNull();
  });

  it("does nothing without both keys, and parses formatVersion=2 responses", async () => {
    process.env.RAKUTEN_APP_ID = "app";
    delete process.env.RAKUTEN_ACCESS_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await rakutenProvider.lookupIsbn("9784101010014")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.RAKUTEN_APP_ID = "app";
    process.env.RAKUTEN_ACCESS_KEY = "key";
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Items: [
            {
              title: "こころ",
              titleKana: "ココロ",
              author: "夏目 漱石",
              publisherName: "新潮社",
              isbn: "9784101010014",
              salesDate: "2004年03月頃",
              itemCaption: "あらすじ",
              largeImageUrl: "https://thumbnail.image.rakuten.co.jp/x.jpg?_ex=200x200",
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const r = await rakutenProvider.lookupIsbn("9784101010014");
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.host).toBe("openapi.rakuten.co.jp");
    expect(url.searchParams.get("isbn")).toBe("9784101010014");
    expect(url.searchParams.get("accessKey")).toBe("key");
    expect(r).toMatchObject({ title: "こころ", authors: ["夏目 漱石"], publisher: "新潮社", publishedAt: "2004-03", coverImage: "https://thumbnail.image.rakuten.co.jp/x.jpg?_ex=400x400" });
  });
});

describe("AI provider config", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it("accepts ChatGPT / OpenAI spellings and normalizes display model names", () => {
    expect(normalizeProvider("ChatGPT", true)).toBe("openai");
    expect(normalizeProvider("OpenAI", true)).toBe("openai");
    expect(normalizeProvider("claude", true)).toBe("anthropic");
    expect(normalizeProvider("", true)).toBe("anthropic");
    expect(normalizeProvider("", false)).toBe("none");
    expect(normalizeModel("GPT-6 Luna", "openai")).toBe("gpt-6-luna");
    expect(normalizeModel("", "openai")).toBe("gpt-6-luna");
    expect(normalizeModel("", "anthropic")).toBe("claude-opus-5");
  });

  it("is configured for OpenAI only with a key", () => {
    process.env.AI_PROVIDER = "ChatGPT";
    process.env.AI_MODEL = "GPT-6 Luna";
    delete process.env.AI_API_KEY;
    expect(aiConfig().configured).toBe(false);
    process.env.AI_API_KEY = "test";
    expect(aiConfig()).toMatchObject({ provider: "openai", model: "gpt-6-luna", configured: true });
  });
});
