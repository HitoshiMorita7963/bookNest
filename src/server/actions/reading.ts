"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import type { ProgressInput, RecordInput } from "@/lib/validators";
import * as reading from "@/server/services/reading";

function done(bookId?: string): ActionResult {
  revalidatePath("/", "layout");
  if (bookId) revalidatePath(`/books/${bookId}`);
  return { ok: true, data: undefined };
}

export async function startReadingAction(bookId: string): Promise<ActionResult> {
  try {
    await reading.startReading(prisma, bookId);
    return done(bookId);
  } catch (e) {
    return toUserError(e);
  }
}

export async function startRereadAction(bookId: string): Promise<ActionResult> {
  try {
    await reading.startReread(prisma, bookId);
    return done(bookId);
  } catch (e) {
    return toUserError(e);
  }
}

export async function updateProgressAction(bookId: string, input: ProgressInput): Promise<ActionResult> {
  try {
    await reading.updateProgress(prisma, bookId, input);
    return done(bookId);
  } catch (e) {
    return toUserError(e);
  }
}

export async function finishReadingAction(bookId: string, input: RecordInput): Promise<ActionResult> {
  try {
    await reading.finishReading(prisma, bookId, input);
    return done(bookId);
  } catch (e) {
    return toUserError(e);
  }
}

export async function updateRecordAction(recordId: string, input: RecordInput): Promise<ActionResult> {
  try {
    const r = await reading.updateRecord(prisma, recordId, input);
    return done(r.bookId);
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteRecordAction(recordId: string, bookId: string): Promise<ActionResult> {
  try {
    await reading.deleteRecord(prisma, recordId);
    return done(bookId);
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteSessionAction(sessionId: string, bookId: string): Promise<ActionResult> {
  try {
    await reading.deleteSession(prisma, sessionId);
    return done(bookId);
  } catch (e) {
    return toUserError(e);
  }
}

export async function sessionsOnDateAction(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return [];
  const rows = await reading.sessionsOnDate(prisma, d);
  return rows.map((r) => ({
    id: r.id,
    pagesRead: r.pagesRead,
    minutes: r.minutes,
    note: r.note,
    endPage: r.endPage,
    book: r.book,
  }));
}
