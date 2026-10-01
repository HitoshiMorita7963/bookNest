"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import type { BookInput } from "@/lib/validators";
import * as books from "@/server/services/books";
import { bookMetadataService, type BookMetadata } from "@/server/services/metadata";
import { parseIsbn } from "@/lib/isbn";

function revalidateBooks(id?: string) {
  revalidatePath("/", "layout");
  if (id) revalidatePath(`/books/${id}`);
}

export async function createBookAction(input: BookInput): Promise<ActionResult<{ id: string }>> {
  try {
    const book = await books.createBook(prisma, input);
    revalidateBooks(book.id);
    return { ok: true, data: { id: book.id } };
  } catch (e) {
    return toUserError(e);
  }
}

export async function updateBookAction(id: string, input: BookInput): Promise<ActionResult<{ id: string }>> {
  try {
    await books.updateBook(prisma, id, input);
    revalidateBooks(id);
    return { ok: true, data: { id } };
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteBookAction(id: string): Promise<ActionResult> {
  try {
    await books.deleteBook(prisma, id);
    revalidateBooks();
    return { ok: true, data: undefined };
  } catch (e) {
    return toUserError(e);
  }
}

export async function changeStatusAction(id: string, status: string): Promise<ActionResult> {
  try {
    await books.changeStatus(prisma, id, status);
    revalidateBooks(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return toUserError(e);
  }
}

export async function lookupIsbnAction(
  isbn: string,
): Promise<ActionResult<{ metadata: BookMetadata | null; existing: { id: string; title: string } | null }>> {
  try {
    const parsed = parseIsbn(isbn);
    if (!parsed) return { ok: false, error: "ISBNの形式が正しくありません（10桁または13桁の数字）", code: "VALIDATION" };
    const existing = await books.findBookByIsbn(prisma, parsed.isbn13);
    const metadata = await bookMetadataService.lookupIsbn(parsed.isbn13);
    return { ok: true, data: { metadata, existing: existing ? { id: existing.id, title: existing.title } : null } };
  } catch (e) {
    console.error("[isbn lookup]", e);
    return { ok: false, error: "書籍情報を取得できませんでした。通信状況を確認するか、手動で入力してください。", code: "NETWORK" };
  }
}

export async function searchMetadataAction(query: string): Promise<ActionResult<BookMetadata[]>> {
  try {
    const q = query.trim().slice(0, 200);
    if (!q) return { ok: true, data: [] };
    return { ok: true, data: await bookMetadataService.search(q) };
  } catch (e) {
    console.error("[metadata search]", e);
    return { ok: false, error: "検索に失敗しました。時間をおいて再度お試しください。", code: "NETWORK" };
  }
}

export async function pickBooksAction(q: string) {
  return books.pickBooks(prisma, q.slice(0, 100));
}

export async function linkRelatedBookAction(fromId: string, toId: string): Promise<ActionResult> {
  try {
    await books.linkRelatedBook(prisma, fromId, toId);
    revalidateBooks(fromId);
    revalidatePath(`/books/${toId}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toUserError(e);
  }
}

export async function unlinkRelatedBookAction(a: string, b: string): Promise<ActionResult> {
  try {
    await books.unlinkRelatedBook(prisma, a, b);
    revalidateBooks(a);
    revalidatePath(`/books/${b}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return toUserError(e);
  }
}
