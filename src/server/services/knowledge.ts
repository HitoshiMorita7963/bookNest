import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { knowledgeInputSchema, type KnowledgeInput } from "@/lib/validators";
import { AppError, NotFoundError } from "@/lib/errors";
import { cleanupOrphans, upsertTags } from "./books";

export const knowledgeListInclude = {
  tags: { include: { tag: true } },
  books: { include: { book: { select: { id: true, title: true, coverImage: true } } } },
  _count: { select: { quotes: true, linksFrom: true, linksTo: true } },
} satisfies Prisma.KnowledgeNoteInclude;

export async function createKnowledge(db: Db, input: KnowledgeInput, opts: { isSample?: boolean } = {}) {
  const data = knowledgeInputSchema.parse(input);
  return db.$transaction(async (tx) => {
    const tagIds = await upsertTags(tx, data.tags);
    const bookIds = data.bookIds.length ? (await tx.book.findMany({ where: { id: { in: data.bookIds } }, select: { id: true } })).map((b) => b.id) : [];
    const quoteIds = data.quoteIds.length ? (await tx.quote.findMany({ where: { id: { in: data.quoteIds } }, select: { id: true } })).map((q) => q.id) : [];
    return tx.knowledgeNote.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        isSample: opts.isSample ?? false,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        books: { create: bookIds.map((bookId) => ({ bookId })) },
        quotes: { create: quoteIds.map((quoteId) => ({ quoteId })) },
      },
    });
  });
}

export async function updateKnowledge(db: Db, id: string, input: KnowledgeInput) {
  const data = knowledgeInputSchema.parse(input);
  const current = await db.knowledgeNote.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("知識");
  return db.$transaction(async (tx) => {
    const tagIds = await upsertTags(tx, data.tags);
    await tx.knowledgeTag.deleteMany({ where: { knowledgeId: id } });
    await tx.bookKnowledge.deleteMany({ where: { knowledgeId: id } });
    await tx.quoteKnowledge.deleteMany({ where: { knowledgeId: id } });
    const bookIds = data.bookIds.length ? (await tx.book.findMany({ where: { id: { in: data.bookIds } }, select: { id: true } })).map((b) => b.id) : [];
    const quoteIds = data.quoteIds.length ? (await tx.quote.findMany({ where: { id: { in: data.quoteIds } }, select: { id: true } })).map((q) => q.id) : [];
    const k = await tx.knowledgeNote.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
        books: { create: bookIds.map((bookId) => ({ bookId })) },
        quotes: { create: quoteIds.map((quoteId) => ({ quoteId })) },
      },
    });
    await cleanupOrphans(tx);
    return k;
  });
}

export async function deleteKnowledge(db: Db, id: string) {
  await db.$transaction(async (tx) => {
    await tx.knowledgeNote.delete({ where: { id } });
    await cleanupOrphans(tx);
  });
}

export async function linkKnowledge(db: Db, fromId: string, toId: string, label?: string | null) {
  if (fromId === toId) throw new AppError("同じ知識同士はつなげられません");
  const [a, b] = await Promise.all([db.knowledgeNote.findUnique({ where: { id: fromId } }), db.knowledgeNote.findUnique({ where: { id: toId } })]);
  if (!a || !b) throw new NotFoundError("知識");
  const reverse = await db.knowledgeLink.findUnique({ where: { fromId_toId: { fromId: toId, toId: fromId } } });
  if (reverse) return reverse;
  return db.knowledgeLink.upsert({
    where: { fromId_toId: { fromId, toId } },
    create: { fromId, toId, label: label?.trim().slice(0, 60) || null },
    update: { label: label?.trim().slice(0, 60) || null },
  });
}

export async function unlinkKnowledge(db: Db, a: string, b: string) {
  await db.knowledgeLink.deleteMany({ where: { OR: [{ fromId: a, toId: b }, { fromId: b, toId: a }] } });
}

/**
 * フレーズと知識をあとから関連付ける。フレーズの本も知識の「関連書籍」に加える。
 */
export async function linkQuoteKnowledge(db: Db, quoteId: string, knowledgeId: string) {
  const [quote, k] = await Promise.all([
    db.quote.findUnique({ where: { id: quoteId }, select: { bookId: true } }),
    db.knowledgeNote.findUnique({ where: { id: knowledgeId }, select: { id: true } }),
  ]);
  if (!quote) throw new NotFoundError("フレーズ");
  if (!k) throw new NotFoundError("知識");
  await db.$transaction(async (tx) => {
    await tx.quoteKnowledge.upsert({ where: { quoteId_knowledgeId: { quoteId, knowledgeId } }, create: { quoteId, knowledgeId }, update: {} });
    if (quote.bookId) {
      await tx.bookKnowledge.upsert({ where: { bookId_knowledgeId: { bookId: quote.bookId, knowledgeId } }, create: { bookId: quote.bookId, knowledgeId }, update: {} });
    }
    await tx.knowledgeNote.update({ where: { id: knowledgeId }, data: { updatedAt: new Date() } });
  });
}

/** フレーズと知識の関連付けを解除する（関連書籍はそのまま残す） */
export async function unlinkQuoteKnowledge(db: Db, quoteId: string, knowledgeId: string) {
  await db.quoteKnowledge.deleteMany({ where: { quoteId, knowledgeId } });
}

export interface KnowledgeQuery {
  q?: string;
  tag?: string;
  category?: string;
  bookId?: string;
}

export function buildKnowledgeWhere(query: KnowledgeQuery): Prisma.KnowledgeNoteWhereInput {
  const and: Prisma.KnowledgeNoteWhereInput[] = [];
  for (const t of (query.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5)) {
    and.push({
      OR: [
        { title: { contains: t } },
        { content: { contains: t } },
        { category: { contains: t } },
        { tags: { some: { tag: { name: { contains: t } } } } },
        { books: { some: { book: { title: { contains: t } } } } },
      ],
    });
  }
  if (query.tag) and.push({ tags: { some: { tag: { name: query.tag } } } });
  if (query.category) and.push({ category: query.category });
  if (query.bookId) and.push({ books: { some: { bookId: query.bookId } } });
  return and.length ? { AND: and } : {};
}

export async function listKnowledge(db: Db, query: KnowledgeQuery = {}) {
  return db.knowledgeNote.findMany({ where: buildKnowledgeWhere(query), include: knowledgeListInclude, orderBy: { updatedAt: "desc" }, take: 300 });
}

export async function getKnowledge(db: Db, id: string) {
  return db.knowledgeNote.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      books: { include: { book: { include: { authors: { include: { author: true }, orderBy: { position: "asc" } } } } } },
      quotes: { include: { quote: { include: { tags: { include: { tag: true } }, book: { select: { id: true, title: true } } } } } },
      linksFrom: { include: { to: { select: { id: true, title: true, category: true } } } },
      linksTo: { include: { from: { select: { id: true, title: true, category: true } } } },
    },
  });
}

export async function knowledgeFacets(db: Db) {
  const [categories, tags] = await Promise.all([
    db.knowledgeNote.groupBy({ by: ["category"], _count: { _all: true }, where: { category: { not: null } } }),
    db.tag.findMany({ where: { knowledge: { some: {} } }, select: { name: true, _count: { select: { knowledge: true } } }, orderBy: { name: "asc" } }),
  ]);
  return { categories: categories.map((c) => ({ name: c.category!, count: c._count._all })), tags };
}

/** 知識マップ用：ノードとエッジ。共通の本で結ばれる暗黙のつながりも含める */
export async function getKnowledgeGraph(db: Db) {
  const notes = await db.knowledgeNote.findMany({
    select: { id: true, title: true, category: true, books: { select: { bookId: true } }, _count: { select: { quotes: true, books: true } } },
  });
  const links = await db.knowledgeLink.findMany({ select: { fromId: true, toId: true, label: true } });
  const explicit = new Set(links.map((l) => [l.fromId, l.toId].sort().join("|")));
  const implicit: { fromId: string; toId: string; label: string | null; implicit: true }[] = [];
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const a = notes[i];
      const b = notes[j];
      const shared = a.books.some((x) => b.books.some((y) => y.bookId === x.bookId));
      const key = [a.id, b.id].sort().join("|");
      if (shared && !explicit.has(key)) implicit.push({ fromId: a.id, toId: b.id, label: "同じ本", implicit: true });
    }
  }
  return {
    nodes: notes.map((n) => ({ id: n.id, title: n.title, category: n.category, weight: n._count.books + n._count.quotes })),
    edges: [...links.map((l) => ({ ...l, implicit: false as const })), ...implicit],
  };
}

export async function pickKnowledge(db: Db, q: string) {
  return db.knowledgeNote.findMany({
    where: q ? buildKnowledgeWhere({ q }) : {},
    select: { id: true, title: true, category: true },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
}
