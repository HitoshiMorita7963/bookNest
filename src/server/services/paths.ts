import type { Db } from "@/lib/db";
import { pathInputSchema } from "@/lib/validators";
import { NotFoundError } from "@/lib/errors";

const DONE = ["COMPLETED"];

export async function createPath(db: Db, input: unknown, opts: { isSample?: boolean } = {}) {
  const data = pathInputSchema.parse(input);
  const books = data.bookIds.length ? await db.book.findMany({ where: { id: { in: data.bookIds } }, select: { id: true } }) : [];
  const valid = data.bookIds.filter((id, i, arr) => arr.indexOf(id) === i && books.some((b) => b.id === id));
  return db.readingPath.create({
    data: {
      title: data.title,
      description: data.description,
      isSample: opts.isSample ?? false,
      books: { create: valid.map((bookId, position) => ({ bookId, position })) },
    },
  });
}

export async function updatePath(db: Db, id: string, input: { title: string; description?: string | null }) {
  const data = pathInputSchema.omit({ bookIds: true }).parse(input);
  return db.readingPath.update({ where: { id }, data });
}

export async function deletePath(db: Db, id: string) {
  await db.readingPath.delete({ where: { id } });
}

export async function addBookToPath(db: Db, pathId: string, bookId: string) {
  const path = await db.readingPath.findUnique({ where: { id: pathId }, include: { books: true } });
  if (!path) throw new NotFoundError("読書ルート");
  if (path.books.some((b) => b.bookId === bookId)) return;
  const max = Math.max(-1, ...path.books.map((b) => b.position));
  await db.readingPathBook.create({ data: { pathId, bookId, position: max + 1 } });
}

export async function removeBookFromPath(db: Db, pathId: string, bookId: string) {
  await db.readingPathBook.deleteMany({ where: { pathId, bookId } });
  await normalize(db, pathId);
}

/** 並び順を 0..n-1 に詰め直す */
async function normalize(db: Db, pathId: string) {
  const rows = await db.readingPathBook.findMany({ where: { pathId }, orderBy: { position: "asc" } });
  await db.$transaction(rows.map((r, i) => db.readingPathBook.update({ where: { pathId_bookId: { pathId, bookId: r.bookId } }, data: { position: i } })));
}

export async function moveBookInPath(db: Db, pathId: string, bookId: string, direction: -1 | 1) {
  const rows = await db.readingPathBook.findMany({ where: { pathId }, orderBy: { position: "asc" } });
  const i = rows.findIndex((r) => r.bookId === bookId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await db.$transaction(rows.map((r, k) => db.readingPathBook.update({ where: { pathId_bookId: { pathId, bookId: r.bookId } }, data: { position: k } })));
}

export async function listPaths(db: Db) {
  const paths = await db.readingPath.findMany({
    include: { books: { orderBy: { position: "asc" }, include: { book: { select: { id: true, title: true, coverImage: true, status: true } } } } },
    orderBy: { updatedAt: "desc" },
  });
  return paths.map((p) => {
    const done = p.books.filter((b) => DONE.includes(b.book.status)).length;
    const next = p.books.find((b) => !DONE.includes(b.book.status) && b.book.status !== "DROPPED");
    return { ...p, done, total: p.books.length, next: next?.book ?? null };
  });
}

export async function getPath(db: Db, id: string) {
  const p = await db.readingPath.findUnique({
    where: { id },
    include: {
      books: {
        orderBy: { position: "asc" },
        include: { book: { include: { authors: { include: { author: true }, orderBy: { position: "asc" } } } } },
      },
    },
  });
  if (!p) return null;
  const nextIdx = p.books.findIndex((b) => !DONE.includes(b.book.status) && b.book.status !== "DROPPED");
  return { ...p, done: p.books.filter((b) => DONE.includes(b.book.status)).length, nextIdx };
}
