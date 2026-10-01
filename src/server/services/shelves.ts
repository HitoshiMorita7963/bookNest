import type { Db } from "@/lib/db";
import { shelfInputSchema } from "@/lib/validators";
import { DuplicateError, NotFoundError } from "@/lib/errors";

export async function listShelves(db: Db) {
  return db.customShelf.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { books: true } },
      books: {
        take: 4,
        orderBy: { addedAt: "desc" },
        include: { book: { select: { id: true, title: true, coverImage: true } } },
      },
    },
  });
}

export async function createShelf(db: Db, input: { name: string; description?: string | null }, opts: { isSample?: boolean } = {}) {
  const data = shelfInputSchema.parse(input);
  const exists = await db.customShelf.findUnique({ where: { name: data.name } });
  if (exists) throw new DuplicateError("同じ名前の本棚が既にあります");
  const max = await db.customShelf.aggregate({ _max: { position: true } });
  return db.customShelf.create({
    data: { ...data, position: (max._max.position ?? 0) + 1, isSample: opts.isSample ?? false },
  });
}

export async function updateShelf(db: Db, id: string, input: { name: string; description?: string | null }) {
  const data = shelfInputSchema.parse(input);
  const dup = await db.customShelf.findFirst({ where: { name: data.name, NOT: { id } } });
  if (dup) throw new DuplicateError("同じ名前の本棚が既にあります");
  return db.customShelf.update({ where: { id }, data });
}

export async function deleteShelf(db: Db, id: string) {
  await db.customShelf.delete({ where: { id } });
}

export async function addBookToShelf(db: Db, shelfId: string, bookId: string) {
  const [shelf, book] = await Promise.all([
    db.customShelf.findUnique({ where: { id: shelfId } }),
    db.book.findUnique({ where: { id: bookId }, select: { id: true } }),
  ]);
  if (!shelf) throw new NotFoundError("本棚");
  if (!book) throw new NotFoundError("本");
  await db.shelfBook.upsert({
    where: { shelfId_bookId: { shelfId, bookId } },
    create: { shelfId, bookId },
    update: {},
  });
}

export async function removeBookFromShelf(db: Db, shelfId: string, bookId: string) {
  await db.shelfBook.deleteMany({ where: { shelfId, bookId } });
}

/** 本が所属する本棚を一括設定 */
export async function setBookShelves(db: Db, bookId: string, shelfIds: string[]) {
  await db.$transaction(async (tx) => {
    await tx.shelfBook.deleteMany({ where: { bookId, shelfId: { notIn: shelfIds } } });
    for (const shelfId of shelfIds) {
      await tx.shelfBook.upsert({
        where: { shelfId_bookId: { shelfId, bookId } },
        create: { shelfId, bookId },
        update: {},
      });
    }
  });
}

export async function getShelf(db: Db, id: string) {
  return db.customShelf.findUnique({ where: { id } });
}
