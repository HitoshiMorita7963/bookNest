import type { Db } from "@/lib/db";
import { authorInputSchema, seriesInputSchema } from "@/lib/validators";
import { DuplicateError, NotFoundError } from "@/lib/errors";

export async function listAuthors(db: Db, q?: string) {
  const authors = await db.author.findMany({
    where: { books: { some: {} }, ...(q ? { OR: [{ name: { contains: q } }, { nameKana: { contains: q } }] } : {}) },
    include: { books: { select: { book: { select: { status: true, rating: true } } } } },
    orderBy: { name: "asc" },
  });
  return authors
    .map((a) => {
      const completed = a.books.filter((b) => b.book.status === "COMPLETED");
      const rated = a.books.filter((b) => b.book.rating != null);
      return {
        id: a.id,
        name: a.name,
        total: a.books.length,
        completed: completed.length,
        avgRating: rated.length ? rated.reduce((s, b) => s + b.book.rating!, 0) / rated.length : null,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ja"));
}

export async function getAuthorDetail(db: Db, id: string) {
  const author = await db.author.findUnique({
    where: { id },
    include: {
      books: {
        include: {
          book: {
            include: { authors: { include: { author: true }, orderBy: { position: "asc" } } },
          },
        },
      },
    },
  });
  if (!author) return null;
  const books = author.books.map((b) => b.book);
  const quoteWhere = { book: { authors: { some: { authorId: id } } } };
  const [quotes, quoteCount] = await Promise.all([
    db.quote.findMany({
      where: quoteWhere,
      include: { tags: { include: { tag: true } }, book: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.quote.count({ where: quoteWhere }),
  ]);
  const rated = books.filter((b) => b.rating != null);
  return {
    author,
    books,
    quotes,
    quoteCount,
    completedCount: books.filter((b) => b.status === "COMPLETED").length,
    avgRating: rated.length ? rated.reduce((s, b) => s + b.rating!, 0) / rated.length : null,
  };
}

export async function updateAuthor(db: Db, id: string, input: unknown) {
  const data = authorInputSchema.parse(input);
  const dup = await db.author.findFirst({ where: { name: data.name, NOT: { id } } });
  if (dup) throw new DuplicateError("同じ名前の著者が既に登録されています");
  const a = await db.author.findUnique({ where: { id } });
  if (!a) throw new NotFoundError("著者");
  return db.author.update({ where: { id }, data });
}

export async function listSeries(db: Db) {
  const series = await db.series.findMany({
    include: { books: { select: { id: true, title: true, coverImage: true, status: true, seriesNumber: true }, orderBy: { seriesNumber: "asc" } } },
    orderBy: { title: "asc" },
  });
  return series.filter((s) => s.books.length);
}

export async function getSeriesDetail(db: Db, id: string) {
  const s = await db.series.findUnique({
    where: { id },
    include: {
      books: {
        include: { authors: { include: { author: true }, orderBy: { position: "asc" } } },
        orderBy: [{ seriesNumber: "asc" }, { title: "asc" }],
      },
    },
  });
  if (!s) return null;
  // 巻数が分かる場合は、未登録の巻も「空き」として並べる
  const numbers = s.books.map((b) => b.seriesNumber).filter((n): n is number => n != null && Number.isInteger(n));
  const maxVol = Math.max(s.totalVolumes ?? 0, ...numbers, 0);
  const volumes: { number: number | null; book: (typeof s.books)[number] | null }[] = [];
  if (maxVol > 0 && maxVol <= 300) {
    for (let n = 1; n <= maxVol; n++) {
      const books = s.books.filter((b) => b.seriesNumber === n);
      if (books.length) books.forEach((book) => volumes.push({ number: n, book }));
      else volumes.push({ number: n, book: null });
    }
    s.books.filter((b) => b.seriesNumber == null || !Number.isInteger(b.seriesNumber)).forEach((book) => volumes.push({ number: book.seriesNumber, book }));
  } else {
    s.books.forEach((book) => volumes.push({ number: book.seriesNumber, book }));
  }
  return { series: s, volumes };
}

export async function updateSeries(db: Db, id: string, input: unknown) {
  const data = seriesInputSchema.parse(input);
  const dup = await db.series.findFirst({ where: { title: data.title, NOT: { id } } });
  if (dup) throw new DuplicateError("同じ名前のシリーズが既にあります");
  return db.series.update({ where: { id }, data });
}
