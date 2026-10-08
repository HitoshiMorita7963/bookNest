import type { Db } from "@/lib/db";
import { authorInputSchema, seriesInputSchema } from "@/lib/validators";
import { DuplicateError, NotFoundError } from "@/lib/errors";
import { findSpacedForm, isUnspacedJapaneseName, normalizeAuthorName } from "@/lib/author-name";

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
      include: { tags: { include: { tag: true } }, book: { select: { id: true, title: true } }, knowledge: { include: { knowledge: { select: { id: true, title: true } } } } },
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
  const parsed = authorInputSchema.parse(input);
  const data = { ...parsed, name: normalizeAuthorName(parsed.name) };
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

/* ---------------- 著者名のスペースの統一 ---------------- */

/** from の著者を to にまとめる（本の紐付けを移し、from を消す）。プロフィールなどは to にないときだけ引き継ぐ */
export async function mergeAuthors(db: Db, fromId: string, toId: string) {
  if (fromId === toId) return;
  await db.$transaction(async (tx) => {
    const [from, to] = await Promise.all([tx.author.findUnique({ where: { id: fromId } }), tx.author.findUnique({ where: { id: toId } })]);
    if (!from || !to) throw new NotFoundError("著者");
    const links = await tx.bookAuthor.findMany({ where: { authorId: fromId } });
    for (const l of links) {
      const already = await tx.bookAuthor.findUnique({ where: { bookId_authorId: { bookId: l.bookId, authorId: toId } } });
      if (already) await tx.bookAuthor.delete({ where: { bookId_authorId: { bookId: l.bookId, authorId: fromId } } });
      else await tx.bookAuthor.update({ where: { bookId_authorId: { bookId: l.bookId, authorId: fromId } }, data: { authorId: toId } });
    }
    await tx.author.update({ where: { id: toId }, data: { nameKana: to.nameKana ?? from.nameKana, profile: to.profile ?? from.profile } });
    await tx.author.delete({ where: { id: fromId } });
  });
}

export interface AuthorNameChange {
  id: string;
  from: string;
  to: string;
  /** rename：名前を直す / merge：同じ人の別表記にまとめる */
  kind: "rename" | "merge";
  /** merge のときのまとめ先 */
  intoId?: string;
  reason: string;
}

/**
 * 著者名のスペースをそろえる計画を立てる（まだ書き込まない）。
 * 1. 全角スペース・連続スペース → 半角1つ
 * 2. スペースのない日本語の名前は、スペースありの同じ名前（別の著者・NDL の表記）があればそれに合わせる
 * lookupNdl を渡すと、本の ISBN で国立国会図書館の著者表記を調べる（スペースの位置がわからない名前だけ）。
 */
export async function planAuthorNameCleanup(db: Db, opts: { lookupNdl?: (isbn13: string) => Promise<string[]> } = {}) {
  const authors = await db.author.findMany({ include: { books: { select: { book: { select: { isbn13: true } } } } }, orderBy: { name: "asc" } });
  const changes: AuthorNameChange[] = [];
  const unresolved: { id: string; name: string; books: number }[] = [];
  // 変更後の名前 → その名前になる著者 ID（同じ名前になるものはまとめる）
  const finalIdByName = new Map<string, string>();
  const targetOf = new Map<string, string>();
  const reasonOf = new Map<string, string>();

  // スペースありの表記（既存の著者の名前）
  const spacedNames = authors.map((a) => normalizeAuthorName(a.name)).filter((n) => n.includes(" "));
  for (const a of authors) {
    let to = normalizeAuthorName(a.name);
    let reason = to !== a.name ? "スペースを半角1つに" : "";
    if (isUnspacedJapaneseName(to)) {
      const spaced = findSpacedForm(to, spacedNames);
      if (spaced) {
        to = spaced;
        reason = "スペースありの表記に合わせる";
      } else if (opts.lookupNdl) {
        for (const isbn of a.books.map((b) => b.book.isbn13).filter((x): x is string => !!x).slice(0, 2)) {
          const found = findSpacedForm(to, await opts.lookupNdl(isbn).catch(() => []));
          if (found) {
            to = found;
            reason = "国立国会図書館の表記に合わせる";
            break;
          }
        }
      }
      if (!to.includes(" ")) unresolved.push({ id: a.id, name: a.name, books: a.books.length });
    }
    targetOf.set(a.id, to);
    reasonOf.set(a.id, reason);
  }
  // まとめ先：変更後の名前と今の名前が同じ著者を優先する
  for (const a of authors) if (targetOf.get(a.id) === a.name) finalIdByName.set(a.name, a.id);
  for (const a of authors) {
    const to = targetOf.get(a.id)!;
    if (!finalIdByName.has(to)) finalIdByName.set(to, a.id);
  }
  for (const a of authors) {
    const to = targetOf.get(a.id)!;
    const intoId = finalIdByName.get(to)!;
    if (intoId !== a.id) changes.push({ id: a.id, from: a.name, to, kind: "merge", intoId, reason: "同じ人の別の表記をまとめる" });
    else if (to !== a.name) changes.push({ id: a.id, from: a.name, to, kind: "rename", reason: reasonOf.get(a.id) || "スペースを半角1つに" });
  }
  return { total: authors.length, changes, unresolved: unresolved.filter((u) => !changes.some((c) => c.id === u.id && c.kind === "merge")) };
}

/** 計画どおりに著者名を直す（名前の変更 → まとめる の順） */
export async function applyAuthorNameCleanup(db: Db, changes: AuthorNameChange[]) {
  let renamed = 0;
  let merged = 0;
  for (const c of changes.filter((c) => c.kind === "rename")) {
    await db.author.update({ where: { id: c.id }, data: { name: c.to } });
    renamed++;
  }
  for (const c of changes.filter((c) => c.kind === "merge")) {
    await mergeAuthors(db, c.id, c.intoId!);
    merged++;
  }
  return { renamed, merged };
}

