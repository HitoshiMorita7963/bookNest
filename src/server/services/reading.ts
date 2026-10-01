import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";
import { progressInputSchema, recordInputSchema, type ProgressInput, type RecordInput } from "@/lib/validators";
import { AppError, NotFoundError } from "@/lib/errors";

type Tx = Prisma.TransactionClient | Db;

async function getOpenRecord(db: Tx, bookId: string) {
  return db.readingRecord.findFirst({
    where: { bookId, status: { in: ["READING", "PAUSED"] } },
    orderBy: { createdAt: "desc" },
  });
}

/** 読書開始（未読・積読から、または中断から再開） */
export async function startReading(db: Db, bookId: string, startedAt?: Date) {
  const book = await db.book.findUnique({ where: { id: bookId } });
  if (!book) throw new NotFoundError("本");
  return db.$transaction(async (tx) => {
    const open = await getOpenRecord(tx, bookId);
    if (open) {
      await tx.readingRecord.update({ where: { id: open.id }, data: { status: "READING" } });
      await tx.book.update({ where: { id: bookId }, data: { status: "READING" } });
      return open;
    }
    const isReread = book.status === "COMPLETED" || book.status === "DROPPED";
    const rec = await tx.readingRecord.create({
      data: { bookId, status: "READING", startedAt: startedAt ?? new Date() },
    });
    await tx.book.update({
      where: { id: bookId },
      data: { status: "READING", startedAt: rec.startedAt, ...(isReread ? { currentPage: 0 } : {}) },
    });
    return rec;
  });
}

/** 再読：新しい読書記録を開始する */
export async function startReread(db: Db, bookId: string) {
  const book = await db.book.findUnique({ where: { id: bookId }, select: { id: true } });
  if (!book) throw new NotFoundError("本");
  return db.$transaction(async (tx) => {
    const open = await getOpenRecord(tx, bookId);
    if (open) throw new AppError("この本は既に読書中です");
    const rec = await tx.readingRecord.create({ data: { bookId, status: "READING", startedAt: new Date() } });
    await tx.book.update({
      where: { id: bookId },
      data: { status: "READING", startedAt: rec.startedAt, currentPage: 0 },
    });
    return rec;
  });
}

/** 進捗更新。ページ差分を読書セッションとして記録する */
export async function updateProgress(db: Db, bookId: string, input: ProgressInput) {
  const data = progressInputSchema.parse(input);
  const book = await db.book.findUnique({ where: { id: bookId } });
  if (!book) throw new NotFoundError("本");
  if (data.currentPage != null && book.pageCount && data.currentPage > book.pageCount) {
    throw new AppError(`ページ数は${book.pageCount}以下で入力してください`, "VALIDATION");
  }
  if (data.currentPage == null && !data.note && !data.minutes) {
    throw new AppError("ページ数またはメモを入力してください", "VALIDATION");
  }

  return db.$transaction(async (tx) => {
    let record = await getOpenRecord(tx, bookId);
    if (!record) {
      // 読書中でない本の進捗を記録した場合は読書開始扱い
      record = await tx.readingRecord.create({ data: { bookId, status: "READING", startedAt: new Date() } });
      await tx.book.update({ where: { id: bookId }, data: { status: "READING", startedAt: record.startedAt } });
    } else if (book.status !== "READING") {
      await tx.readingRecord.update({ where: { id: record.id }, data: { status: "READING" } });
      await tx.book.update({ where: { id: bookId }, data: { status: "READING" } });
    }
    const newPage = data.currentPage ?? book.currentPage;
    const pagesRead = Math.max(0, newPage - book.currentPage);
    const session = await tx.readingSession.create({
      data: {
        bookId,
        recordId: record.id,
        date: data.date ?? new Date(),
        startPage: data.currentPage != null ? book.currentPage : null,
        endPage: data.currentPage ?? null,
        pagesRead,
        minutes: data.minutes,
        note: data.note,
      },
    });
    if (data.currentPage != null) {
      await tx.book.update({ where: { id: bookId }, data: { currentPage: newPage } });
    }
    return session;
  });
}

/** 読書メモのみを追加 */
export async function addReadingNote(db: Db, bookId: string, note: string) {
  return updateProgress(db, bookId, { note });
}

/** 読了処理。入力は全て省略可能 */
export async function finishReading(db: Db, bookId: string, input: RecordInput = {}) {
  const data = recordInputSchema.parse({ ...input, status: "COMPLETED" });
  const book = await db.book.findUnique({ where: { id: bookId } });
  if (!book) throw new NotFoundError("本");
  const finishedAt = data.finishedAt ?? new Date();

  return db.$transaction(async (tx) => {
    const open = await getOpenRecord(tx, bookId);
    const recordData = {
      status: "COMPLETED",
      finishedAt,
      rating: data.rating,
      review: data.review,
      summary: data.summary,
      learned: data.learned,
      memorable: data.memorable,
      questions: data.questions,
      ...(data.startedAt ? { startedAt: data.startedAt } : {}),
    };
    const record = open
      ? await tx.readingRecord.update({ where: { id: open.id }, data: recordData })
      : await tx.readingRecord.create({ data: { bookId, ...recordData, startedAt: data.startedAt ?? book.startedAt } });

    // 最後のページまでの差分をセッションとして記録（統計のページ数に反映）
    if (book.pageCount && book.currentPage < book.pageCount) {
      await tx.readingSession.create({
        data: {
          bookId,
          recordId: record.id,
          date: finishedAt,
          startPage: book.currentPage,
          endPage: book.pageCount,
          pagesRead: book.pageCount - book.currentPage,
        },
      });
    }
    await tx.book.update({
      where: { id: bookId },
      data: {
        status: "COMPLETED",
        finishedAt,
        rating: data.rating ?? book.rating,
        currentPage: book.pageCount ?? book.currentPage,
      },
    });
    return record;
  });
}

export async function updateRecord(db: Db, recordId: string, input: RecordInput) {
  const data = recordInputSchema.parse(input);
  const rec = await db.readingRecord.findUnique({ where: { id: recordId } });
  if (!rec) throw new NotFoundError("読書記録");
  return db.$transaction(async (tx) => {
    const updated = await tx.readingRecord.update({ where: { id: recordId }, data });
    await syncBookFromRecords(tx, rec.bookId);
    return updated;
  });
}

export async function deleteRecord(db: Db, recordId: string) {
  const rec = await db.readingRecord.findUnique({ where: { id: recordId } });
  if (!rec) throw new NotFoundError("読書記録");
  await db.$transaction(async (tx) => {
    await tx.readingRecord.delete({ where: { id: recordId } });
    await syncBookFromRecords(tx, rec.bookId);
  });
}

export async function deleteSession(db: Db, sessionId: string) {
  await db.readingSession.delete({ where: { id: sessionId } });
}

/** 読書記録から本の非正規化フィールド（評価・読了日・開始日）を再計算 */
export async function syncBookFromRecords(db: Tx, bookId: string) {
  const records = await db.readingRecord.findMany({ where: { bookId }, orderBy: { createdAt: "desc" } });
  const latestCompleted = records
    .filter((r) => r.finishedAt)
    .sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime())[0];
  const latestRated = records.find((r) => r.rating != null);
  const latestStarted = records.find((r) => r.startedAt);
  await db.book.update({
    where: { id: bookId },
    data: {
      finishedAt: latestCompleted?.finishedAt ?? null,
      rating: latestRated?.rating ?? null,
      startedAt: latestStarted?.startedAt ?? null,
    },
  });
}

export async function listReadingBooks(db: Db) {
  return db.book.findMany({
    where: { status: "READING" },
    include: {
      authors: { include: { author: true }, orderBy: { position: "asc" } },
      sessions: { orderBy: { date: "desc" }, take: 3 },
      _count: { select: { quotes: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/** 指定日の読書活動 */
export async function sessionsOnDate(db: Db, date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start.getTime() + 86400000);
  return db.readingSession.findMany({
    where: { date: { gte: start, lt: end } },
    include: { book: { select: { id: true, title: true, coverImage: true } } },
    orderBy: { date: "asc" },
  });
}
