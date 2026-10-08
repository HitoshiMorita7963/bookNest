/**
 * QuoteService：フレーズの保存・編集・検索
 */
import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { quoteInputSchema, type QuoteInput } from "@/lib/validators";
import { NotFoundError } from "@/lib/errors";
import { cleanupOrphans, upsertTags } from "./books";
import { deleteImageByUrl } from "./images";

export const quoteInclude = {
  tags: { include: { tag: true } },
  book: { select: { id: true, title: true, coverImage: true, authors: { include: { author: true }, orderBy: { position: "asc" } } } },
  // 一覧のカードに、つながっている知識を表示する
  knowledge: { include: { knowledge: { select: { id: true, title: true } } } },
} satisfies Prisma.QuoteInclude;

export async function createQuote(db: Db, input: QuoteInput, opts: { isSample?: boolean } = {}) {
  const data = quoteInputSchema.parse(input);
  if (data.bookId) {
    const book = await db.book.findUnique({ where: { id: data.bookId }, select: { id: true } });
    if (!book) throw new NotFoundError("本");
  }
  return db.$transaction(async (tx) => {
    const tagIds = await upsertTags(tx, data.tags);
    return tx.quote.create({
      data: {
        text: data.text,
        bookId: data.bookId,
        pageNumber: data.pageNumber,
        note: data.note,
        originalImage: data.originalImage,
        isFavorite: data.isFavorite,
        isSample: opts.isSample ?? false,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
  });
}

export async function updateQuote(db: Db, id: string, input: QuoteInput) {
  const data = quoteInputSchema.parse(input);
  const current = await db.quote.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("フレーズ");
  if (data.bookId) {
    const book = await db.book.findUnique({ where: { id: data.bookId }, select: { id: true } });
    if (!book) throw new NotFoundError("本");
  }
  const updated = await db.$transaction(async (tx) => {
    const tagIds = await upsertTags(tx, data.tags);
    await tx.quoteTag.deleteMany({ where: { quoteId: id } });
    const q = await tx.quote.update({
      where: { id },
      data: {
        text: data.text,
        bookId: data.bookId,
        pageNumber: data.pageNumber,
        note: data.note,
        originalImage: data.originalImage,
        isFavorite: data.isFavorite,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    await cleanupOrphans(tx);
    return q;
  });
  if (current.originalImage && current.originalImage !== data.originalImage) await deleteImageByUrl(current.originalImage);
  return updated;
}

export async function deleteQuote(db: Db, id: string) {
  const q = await db.quote.findUnique({ where: { id } });
  if (!q) throw new NotFoundError("フレーズ");
  await db.$transaction(async (tx) => {
    await tx.quote.delete({ where: { id } });
    await cleanupOrphans(tx);
  });
  await deleteImageByUrl(q.originalImage);
}

export async function toggleFavorite(db: Db, id: string) {
  const q = await db.quote.findUnique({ where: { id }, select: { isFavorite: true } });
  if (!q) throw new NotFoundError("フレーズ");
  return db.quote.update({ where: { id }, data: { isFavorite: !q.isFavorite } });
}

export interface QuoteQuery {
  q?: string;
  tag?: string;
  bookId?: string;
  authorId?: string;
  favorite?: boolean;
  page?: number;
  pageSize?: number;
}

export function buildQuoteWhere(query: QuoteQuery): Prisma.QuoteWhereInput {
  const and: Prisma.QuoteWhereInput[] = [];
  const terms = (query.q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  for (const t of terms) {
    and.push({
      OR: [
        { text: { contains: t } },
        { note: { contains: t } },
        { tags: { some: { tag: { name: { contains: t } } } } },
        { book: { title: { contains: t } } },
        { book: { authors: { some: { author: { name: { contains: t } } } } } },
      ],
    });
  }
  if (query.tag) and.push({ tags: { some: { tag: { name: query.tag } } } });
  if (query.bookId) and.push({ bookId: query.bookId });
  if (query.authorId) and.push({ book: { authors: { some: { authorId: query.authorId } } } });
  if (query.favorite) and.push({ isFavorite: true });
  return and.length ? { AND: and } : {};
}

export async function listQuotes(db: Db, query: QuoteQuery = {}) {
  const where = buildQuoteWhere(query);
  const pageSize = query.pageSize ?? 30;
  const page = Math.max(1, query.page ?? 1);
  const [items, total] = await Promise.all([
    db.quote.findMany({ where, include: quoteInclude, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    db.quote.count({ where }),
  ]);
  return { items, total, hasMore: page * pageSize < total };
}

export async function getQuote(db: Db, id: string) {
  return db.quote.findUnique({
    where: { id },
    include: { ...quoteInclude, knowledge: { include: { knowledge: true } } },
  });
}

export async function quoteTags(db: Db) {
  return db.tag.findMany({
    where: { quotes: { some: {} } },
    select: { name: true, _count: { select: { quotes: true } } },
    orderBy: { name: "asc" },
  });
}
