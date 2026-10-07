import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { bookInputSchema, type BookInput, bookStatusSchema } from "@/lib/validators";
import { parseIsbn } from "@/lib/isbn";
import { DuplicateError, NotFoundError, AppError } from "@/lib/errors";
import { PAGE_SIZE, type BookStatus, type SortKey } from "@/lib/constants";

type Tx = Prisma.TransactionClient | Db;

export const bookListInclude = {
  authors: { include: { author: true }, orderBy: { position: "asc" } },
} satisfies Prisma.BookInclude;

export type BookListItem = Prisma.BookGetPayload<{ include: typeof bookListInclude }>;

export async function upsertTags(db: Tx, names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const tag = await db.tag.upsert({ where: { name }, create: { name }, update: {} });
    ids.push(tag.id);
  }
  return ids;
}

export async function upsertAuthors(db: Tx, names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const a = await db.author.upsert({ where: { name }, create: { name }, update: {} });
    ids.push(a.id);
  }
  return ids;
}

async function resolveSeries(db: Tx, title: string | null): Promise<string | null> {
  if (!title) return null;
  const s = await db.series.upsert({ where: { title }, create: { title }, update: {} });
  return s.id;
}

function publishedYearOf(publishedAt: string | null): number | null {
  if (!publishedAt) return null;
  const m = publishedAt.match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

export async function findBookByIsbn(db: Db, isbnInput: string) {
  const parsed = parseIsbn(isbnInput);
  if (!parsed) return null;
  return db.book.findFirst({
    where: { OR: [{ isbn13: parsed.isbn13 }, ...(parsed.isbn10 ? [{ isbn10: parsed.isbn10 }] : [])] },
    select: { id: true, title: true, status: true },
  });
}

export async function createBook(db: Db, input: BookInput, opts: { isSample?: boolean } = {}) {
  const data = bookInputSchema.parse(input);
  let isbn13: string | null = null;
  let isbn10: string | null = null;
  if (data.isbn) {
    const parsed = parseIsbn(data.isbn);
    if (!parsed) throw new AppError("ISBNの形式が正しくありません（10桁または13桁）", "VALIDATION");
    isbn13 = parsed.isbn13;
    isbn10 = parsed.isbn10;
    const existing = await findBookByIsbn(db, parsed.isbn13);
    if (existing) {
      throw new DuplicateError(`この本は既に登録されています：『${existing.title}』`, { bookId: existing.id });
    }
  }

  return db.$transaction(async (tx) => {
    const authorIds = await upsertAuthors(tx, data.authors);
    const tagIds = await upsertTags(tx, data.tags);
    const seriesId = await resolveSeries(tx, data.seriesTitle);
    const now = new Date();
    const book = await tx.book.create({
      data: {
        title: data.title,
        titleKana: data.titleKana,
        subtitle: data.subtitle,
        description: data.description,
        isbn13,
        isbn10,
        publisher: data.publisher,
        publishedAt: data.publishedAt,
        publishedYear: publishedYearOf(data.publishedAt),
        pageCount: data.pageCount,
        coverImage: data.coverImage,
        language: data.language ?? "ja",
        genre: data.genre,
        status: data.status,
        acquiredAt: data.acquiredAt ?? (data.status === "OWNED" ? now : null),
        seriesId,
        seriesNumber: data.seriesNumber,
        isSample: opts.isSample ?? false,
        authors: { create: authorIds.map((authorId, position) => ({ authorId, position })) },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    // 読書中・読了で登録した場合は読書記録も作る
    if (data.status === "READING") {
      const rec = await tx.readingRecord.create({ data: { bookId: book.id, status: "READING", startedAt: now } });
      await tx.book.update({ where: { id: book.id }, data: { startedAt: rec.startedAt } });
    } else if (data.status === "COMPLETED") {
      await tx.readingRecord.create({ data: { bookId: book.id, status: "COMPLETED", finishedAt: now } });
      await tx.book.update({
        where: { id: book.id },
        data: { finishedAt: now, currentPage: data.pageCount ?? 0 },
      });
    }
    return book;
  });
}

export async function updateBook(db: Db, id: string, input: BookInput) {
  const data = bookInputSchema.parse(input);
  const current = await db.book.findUnique({ where: { id } });
  if (!current) throw new NotFoundError("本");

  let isbn13: string | null = null;
  let isbn10: string | null = null;
  if (data.isbn) {
    const parsed = parseIsbn(data.isbn);
    if (!parsed) throw new AppError("ISBNの形式が正しくありません（10桁または13桁）", "VALIDATION");
    isbn13 = parsed.isbn13;
    isbn10 = parsed.isbn10;
    const dup = await db.book.findFirst({ where: { isbn13, NOT: { id } }, select: { id: true, title: true } });
    if (dup) throw new DuplicateError(`同じISBNの本が既に登録されています：『${dup.title}』`, { bookId: dup.id });
  }

  return db.$transaction(async (tx) => {
    const authorIds = await upsertAuthors(tx, data.authors);
    const tagIds = await upsertTags(tx, data.tags);
    const seriesId = await resolveSeries(tx, data.seriesTitle);
    await tx.bookAuthor.deleteMany({ where: { bookId: id } });
    await tx.bookTag.deleteMany({ where: { bookId: id } });
    const book = await tx.book.update({
      where: { id },
      data: {
        title: data.title,
        titleKana: data.titleKana,
        subtitle: data.subtitle,
        description: data.description,
        isbn13,
        isbn10,
        publisher: data.publisher,
        publishedAt: data.publishedAt,
        publishedYear: publishedYearOf(data.publishedAt),
        pageCount: data.pageCount,
        coverImage: data.coverImage,
        language: data.language ?? "ja",
        genre: data.genre,
        acquiredAt: data.acquiredAt,
        seriesId,
        seriesNumber: data.seriesNumber,
        authors: { create: authorIds.map((authorId, position) => ({ authorId, position })) },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
    });
    if (data.status !== current.status) {
      await applyStatusChange(tx, id, current.status as BookStatus, data.status);
    }
    await cleanupOrphans(tx);
    return book;
  });
}

export async function deleteBook(db: Db, id: string) {
  const book = await db.book.findUnique({ where: { id }, select: { id: true } });
  if (!book) throw new NotFoundError("本");
  await db.$transaction(async (tx) => {
    await tx.book.delete({ where: { id } });
    await cleanupOrphans(tx);
  });
}

/** どの本にも紐付かない著者・シリーズを掃除（タグはフレーズ等でも使うため、全く未使用のもののみ） */
export async function cleanupOrphans(db: Tx) {
  await db.author.deleteMany({ where: { books: { none: {} }, profile: null } });
  await db.series.deleteMany({ where: { books: { none: {} }, description: null } });
  await db.tag.deleteMany({ where: { books: { none: {} }, quotes: { none: {} }, knowledge: { none: {} }, creativeNotes: { none: {} }, creativeKnowledge: { none: {} } } });
}

async function openRecord(db: Tx, bookId: string) {
  return db.readingRecord.findFirst({
    where: { bookId, status: { in: ["READING", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
  });
}

/** ステータス変更に伴う読書記録の生成・更新 */
async function applyStatusChange(db: Tx, bookId: string, from: BookStatus, to: BookStatus) {
  const now = new Date();
  const open = await openRecord(db, bookId);
  const bookUpdate: Prisma.BookUpdateInput = { status: to };

  if (to === "READING") {
    if (open) {
      await db.readingRecord.update({ where: { id: open.id }, data: { status: "READING" } });
    } else {
      const rec = await db.readingRecord.create({ data: { bookId, status: "READING", startedAt: now } });
      bookUpdate.startedAt = rec.startedAt;
      if (from === "COMPLETED" || from === "DROPPED") bookUpdate.currentPage = 0; // 再読
    }
  } else if (to === "COMPLETED") {
    const book = await db.book.findUnique({ where: { id: bookId }, select: { pageCount: true } });
    if (open) {
      await db.readingRecord.update({ where: { id: open.id }, data: { status: "COMPLETED", finishedAt: now } });
    } else if (from !== "COMPLETED") {
      await db.readingRecord.create({ data: { bookId, status: "COMPLETED", finishedAt: now } });
    }
    bookUpdate.finishedAt = now;
    if (book?.pageCount) bookUpdate.currentPage = book.pageCount;
  } else if (to === "PAUSED" || to === "DROPPED") {
    if (open) await db.readingRecord.update({ where: { id: open.id }, data: { status: to } });
  } else if (to === "OWNED") {
    const book = await db.book.findUnique({ where: { id: bookId }, select: { acquiredAt: true } });
    if (!book?.acquiredAt) bookUpdate.acquiredAt = now;
  }
  await db.book.update({ where: { id: bookId }, data: bookUpdate });
}

export async function changeStatus(db: Db, bookId: string, status: string) {
  const to = bookStatusSchema.parse(status);
  const book = await db.book.findUnique({ where: { id: bookId }, select: { status: true } });
  if (!book) throw new NotFoundError("本");
  if (book.status === to) return;
  await db.$transaction((tx) => applyStatusChange(tx, bookId, book.status as BookStatus, to));
}

export async function getBookDetail(db: Db, id: string) {
  return db.book.findUnique({
    where: { id },
    include: {
      authors: { include: { author: true }, orderBy: { position: "asc" } },
      tags: { include: { tag: true } },
      series: { include: { books: { select: { id: true, title: true, seriesNumber: true, status: true, coverImage: true }, orderBy: { seriesNumber: "asc" } } } },
      records: { orderBy: [{ createdAt: "desc" }] },
      sessions: { orderBy: { date: "desc" }, take: 30 },
      shelves: { include: { shelf: true } },
      quotes: { include: { tags: { include: { tag: true } } }, orderBy: { createdAt: "desc" } },
      knowledge: { include: { knowledge: true } },
      relatedTo: { include: { to: { include: bookListInclude } } },
      relatedBy: { include: { from: { include: bookListInclude } } },
      paths: { include: { path: true } },
      _count: { select: { quotes: true } },
    },
  });
}
export type BookDetail = NonNullable<Awaited<ReturnType<typeof getBookDetail>>>;

export interface BookQuery {
  q?: string;
  status?: string;
  genre?: string;
  tag?: string;
  authorId?: string;
  shelfId?: string;
  minRating?: number;
  publishedFrom?: number;
  publishedTo?: number;
  finishedYear?: number;
  minPages?: number;
  maxPages?: number;
  sort?: SortKey;
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export function buildBookWhere(q: BookQuery): Prisma.BookWhereInput {
  const and: Prisma.BookWhereInput[] = [];
  if (q.q) {
    const terms = q.q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
    for (const term of terms) {
      const digits = term.replace(/[-ー－]/g, "");
      and.push({
        OR: [
          { title: { contains: term } },
          { subtitle: { contains: term } },
          { titleKana: { contains: term } },
          { publisher: { contains: term } },
          { isbn13: { contains: digits } },
          { isbn10: { contains: digits } },
          { genre: { contains: term } },
          { authors: { some: { author: { name: { contains: term } } } } },
          { tags: { some: { tag: { name: { contains: term } } } } },
          { series: { title: { contains: term } } },
        ],
      });
    }
  }
  if (q.status) {
    const statuses = q.status.split(",").filter((s) => bookStatusSchema.safeParse(s).success);
    if (statuses.length) and.push({ status: { in: statuses } });
  }
  if (q.genre) and.push({ genre: q.genre });
  if (q.tag) and.push({ tags: { some: { tag: { name: q.tag } } } });
  if (q.authorId) and.push({ authors: { some: { authorId: q.authorId } } });
  if (q.shelfId) and.push({ shelves: { some: { shelfId: q.shelfId } } });
  if (q.minRating) and.push({ rating: { gte: q.minRating } });
  if (q.publishedFrom) and.push({ publishedYear: { gte: q.publishedFrom } });
  if (q.publishedTo) and.push({ publishedYear: { lte: q.publishedTo } });
  if (q.finishedYear) {
    and.push({
      finishedAt: { gte: new Date(q.finishedYear, 0, 1), lt: new Date(q.finishedYear + 1, 0, 1) },
    });
  }
  if (q.minPages) and.push({ pageCount: { gte: q.minPages } });
  if (q.maxPages) and.push({ pageCount: { lte: q.maxPages } });
  return and.length ? { AND: and } : {};
}

function buildOrder(sort: SortKey = "createdAt", order?: "asc" | "desc"): Prisma.BookOrderByWithRelationInput[] {
  const dir = order ?? (sort === "title" ? "asc" : "desc");
  switch (sort) {
    case "title":
      return [{ title: dir }];
    case "rating":
      return [{ rating: { sort: dir, nulls: "last" } }, { createdAt: "desc" }];
    case "finishedAt":
      return [{ finishedAt: { sort: dir, nulls: "last" } }, { createdAt: "desc" }];
    case "pageCount":
      return [{ pageCount: { sort: dir, nulls: "last" } }, { createdAt: "desc" }];
    case "publishedAt":
      return [{ publishedAt: { sort: dir, nulls: "last" } }, { createdAt: "desc" }];
    default:
      return [{ createdAt: dir }];
  }
}

export async function listBooks(db: Db, q: BookQuery = {}) {
  const where = buildBookWhere(q);
  const pageSize = q.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, q.page ?? 1);
  const [items, total] = await Promise.all([
    db.book.findMany({
      where,
      include: bookListInclude,
      orderBy: buildOrder(q.sort, q.order),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.book.count({ where }),
  ]);
  return { items, total, page, pageSize, hasMore: page * pageSize < total };
}

export async function countByStatus(db: Db) {
  const rows = await db.book.groupBy({ by: ["status"], _count: { _all: true } });
  const result: Record<string, number> = {};
  for (const r of rows) result[r.status] = r._count._all;
  return result;
}

export async function listFacets(db: Db) {
  const [genres, tags, authors] = await Promise.all([
    db.book.groupBy({ by: ["genre"], _count: { _all: true }, where: { genre: { not: null } } }),
    db.tag.findMany({ where: { books: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.author.findMany({ where: { books: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return {
    genres: genres.map((g) => g.genre!).filter(Boolean).sort(),
    tags,
    authors,
  };
}

export async function linkRelatedBook(db: Db, fromId: string, toId: string, note?: string) {
  if (fromId === toId) throw new AppError("同じ本は関連付けできません");
  await db.bookRelation.upsert({
    where: { fromId_toId: { fromId, toId } },
    create: { fromId, toId, note },
    update: { note },
  });
}

export async function unlinkRelatedBook(db: Db, a: string, b: string) {
  await db.bookRelation.deleteMany({
    where: { OR: [{ fromId: a, toId: b }, { fromId: b, toId: a }] },
  });
}

/** 本選択用の軽量検索 */
export async function pickBooks(db: Db, q: string, take = 20) {
  return db.book.findMany({
    where: q ? buildBookWhere({ q }) : {},
    select: { id: true, title: true, coverImage: true, status: true, authors: { select: { author: { select: { name: true } } }, take: 2 } },
    orderBy: q ? [{ title: "asc" }] : [{ updatedAt: "desc" }],
    take,
  });
}

/** タグ・著者・ジャンルが共通する本を自動で関連付けて返す（スコア順） */
export async function autoRelatedBooks(db: Db, bookId: string, take = 8) {
  const book = await db.book.findUnique({
    where: { id: bookId },
    select: { genre: true, seriesId: true, tags: { select: { tagId: true } }, authors: { select: { authorId: true } } },
  });
  if (!book) return [];
  const tagIds = book.tags.map((t) => t.tagId);
  const authorIds = book.authors.map((a) => a.authorId);
  const or: Prisma.BookWhereInput[] = [];
  if (tagIds.length) or.push({ tags: { some: { tagId: { in: tagIds } } } });
  if (authorIds.length) or.push({ authors: { some: { authorId: { in: authorIds } } } });
  if (book.genre) or.push({ genre: book.genre });
  if (!or.length) return [];
  const candidates = await db.book.findMany({
    where: { id: { not: bookId }, OR: or, ...(book.seriesId ? { NOT: { seriesId: book.seriesId } } : {}) },
    include: { ...bookListInclude, tags: { select: { tagId: true } } },
    take: 200,
  });
  return candidates
    .map((c) => {
      const sharedTags = c.tags.filter((t) => tagIds.includes(t.tagId)).length;
      const sharedAuthors = c.authors.filter((a) => authorIds.includes(a.authorId)).length;
      const score = sharedTags * 2 + sharedAuthors * 3 + (c.genre && c.genre === book.genre ? 1 : 0) + (c.rating ?? 0) * 0.1;
      return { book: c, score, reason: sharedAuthors ? "同じ著者" : sharedTags ? "共通のタグ" : "同じジャンル" };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, take);
}
