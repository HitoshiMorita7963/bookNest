import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDb } from "./helpers";
import { createBook } from "@/server/services/books";
import { createQuote, deleteQuote } from "@/server/services/quotes";
import { createKnowledge } from "@/server/services/knowledge";
import { finishReading, startReading, updateProgress } from "@/server/services/reading";
import { createCreativeKnowledge, deleteCreativeKnowledge } from "@/server/services/creative-knowledge";
import {
  addCkReference,
  ckReferencesOf,
  ckUsageOfSource,
  createCreativeKnowledgeFromSource,
  pickReadingSources,
  removeCkReference,
  updateCkReference,
} from "@/server/services/creative-knowledge-references";

beforeEach(resetDb);

async function readingData() {
  const book = await createBook(db, { title: "銀河英雄伝説", pageCount: 300, status: "OWNED" });
  await startReading(db, book.id);
  await updateProgress(db, book.id, { currentPage: 120, note: "敵の名将が主人公を認める場面が良かった" });
  await finishReading(db, book.id, { rating: 5, review: "ライバル同士の敬意が胸に残る" });
  const session = await db.readingSession.findFirstOrThrow({ where: { bookId: book.id, note: { not: null } } });
  const record = await db.readingRecord.findFirstOrThrow({ where: { bookId: book.id } });
  const quote = await createQuote(db, { text: "敵ながら見事だ", bookId: book.id, pageNumber: "142" });
  const note = await createKnowledge(db, { title: "名将の条件" });
  const ck = await createCreativeKnowledge(db, { title: "敵から味方へ", category: "TROPE" });
  return { book, session, record, quote, note, ck };
}

describe("references from reading to creative knowledge", () => {
  it("adds every kind of reading source and describes them for display", async () => {
    const d = await readingData();
    await addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "quote", id: d.quote.id }, comment: "敵を認める台詞", location: "第10章" });
    await addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "session", id: d.session.id } });
    await addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "record", id: d.record.id } });
    await addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "knowledgeNote", id: d.note.id } });
    await addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "book", id: d.book.id } });
    await addCkReference(db, { knowledgeId: d.ck.id, workTitle: "スター・ウォーズ", comment: "ベイダーの最期" });
    const refs = await ckReferencesOf(db, d.ck.id);
    expect(refs.map((r) => r.kind)).toEqual(["quote", "session", "record", "knowledgeNote", "book", "work"]);
    expect(refs[0]).toMatchObject({ label: "敵ながら見事だ", sub: "『銀河英雄伝説』 142", location: "第10章", comment: "敵を認める台詞", href: `/quotes/${d.quote.id}` });
    expect(refs[1].label).toContain("敵の名将");
    expect(refs[2].label).toBe("ライバル同士の敬意が胸に残る");
    expect(refs[5]).toMatchObject({ label: "『スター・ウォーズ』", href: null });
  });

  it("updates instead of duplicating the same source, and validates input", async () => {
    const d = await readingData();
    await addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "quote", id: d.quote.id }, comment: "最初の気づき" });
    await addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "quote", id: d.quote.id }, comment: "書き直した気づき" });
    const refs = await ckReferencesOf(db, d.ck.id);
    expect(refs).toHaveLength(1);
    expect(refs[0].comment).toBe("書き直した気づき");
    await updateCkReference(db, refs[0].id, { comment: "編集", location: "p.142" });
    expect((await ckReferencesOf(db, d.ck.id))[0]).toMatchObject({ comment: "編集", location: "p.142" });
    await expect(addCkReference(db, { knowledgeId: d.ck.id })).rejects.toThrow();
    await expect(addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "quote", id: "missing" } })).rejects.toThrow();
    await expect(addCkReference(db, { knowledgeId: "missing", workTitle: "x" })).rejects.toThrow();
  });

  it("saves reading data as new creative knowledge (創作知識として保存)", async () => {
    const d = await readingData();
    const k = await createCreativeKnowledgeFromSource(db, { title: "好敵手への敬意", category: "CHARACTER", subCategory: "ライバル" }, { source: { kind: "session", id: d.session.id }, comment: "敵を認める", location: "中盤" });
    const refs = await ckReferencesOf(db, k.id);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({ kind: "session", comment: "敵を認める", location: "中盤" });
    await expect(createCreativeKnowledgeFromSource(db, { title: "x", category: "PLOT" }, { source: { kind: "quote", id: "missing" } })).rejects.toThrow();
    expect(await db.creativeKnowledge.count({ where: { title: "x" } })).toBe(0);
  });

  it("finds creative knowledge from the reading side (reverse lookup), including via the book's quotes and notes", async () => {
    const d = await readingData();
    const other = await createCreativeKnowledge(db, { title: "ライバル", category: "CHARACTER" });
    await addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "quote", id: d.quote.id }, comment: "台詞" });
    await addCkReference(db, { knowledgeId: other.id, source: { kind: "record", id: d.record.id } });
    expect((await ckUsageOfSource(db, { kind: "quote", id: d.quote.id })).map((k) => [k.title, k.comments])).toEqual([["敵から味方へ", ["台詞"]]]);
    expect((await ckUsageOfSource(db, { kind: "book", id: d.book.id })).map((k) => k.title).sort()).toEqual(["ライバル", "敵から味方へ"].sort());
    expect(await ckUsageOfSource(db, { kind: "knowledgeNote", id: d.note.id })).toEqual([]);
  });

  it("removes references, and they disappear when the source or the knowledge is deleted", async () => {
    const d = await readingData();
    await addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "quote", id: d.quote.id } });
    const w = await addCkReference(db, { knowledgeId: d.ck.id, workTitle: "作品X" });
    await removeCkReference(db, w.id);
    expect(await ckReferencesOf(db, d.ck.id)).toHaveLength(1);
    await deleteQuote(db, d.quote.id);
    expect(await ckReferencesOf(db, d.ck.id)).toHaveLength(0);
    await addCkReference(db, { knowledgeId: d.ck.id, source: { kind: "book", id: d.book.id } });
    await deleteCreativeKnowledge(db, d.ck.id);
    expect(await db.creativeKnowledgeReference.count()).toBe(0);
    expect(await db.book.count()).toBe(1);
  });

  it("lists reading sources to pick from across books, quotes, notes, reviews and knowledge", async () => {
    await readingData();
    const all = await pickReadingSources(db, "");
    expect(new Set(all.map((s) => s.kind))).toEqual(new Set(["book", "quote", "session", "record", "knowledgeNote"]));
    const hit = await pickReadingSources(db, "名将");
    expect(hit.map((s) => s.kind).sort()).toEqual(["knowledgeNote", "session"]);
  });
});
