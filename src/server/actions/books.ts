"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import type { BookInput } from "@/lib/validators";
import * as books from "@/server/services/books";
import { bookMetadataService, ndlProvider, type BookMetadata } from "@/server/services/metadata";
import { classifyByRules, type Classification, type ClassifyInput } from "@/lib/classify";
import { aiAvailable } from "@/server/ai/librarian";
import { suggestGenreTags } from "@/server/ai/features";
import { parseIsbn } from "@/lib/isbn";
import { syncBookRowsLater, syncSheetLater } from "@/server/sheets-sync";

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
    await syncBookRowsLater(id);
    revalidateBooks(id);
    return { ok: true, data: { id } };
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteBookAction(id: string): Promise<ActionResult> {
  try {
    const [qs, ks] = await Promise.all([
      prisma.quote.findMany({ where: { bookId: id }, select: { id: true } }),
      prisma.bookKnowledge.findMany({ where: { bookId: id }, select: { knowledgeId: true } }),
    ]);
    await books.deleteBook(prisma, id);
    syncSheetLater("quote", ...qs.map((q) => q.id));
    syncSheetLater("knowledge", ...ks.map((k) => k.knowledgeId));
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

/** 登録時にジャンル・タグを自動で提案する（AI が使えれば AI、使えなければキーワードと分類番号から推定） */
export async function classifyBookAction(input: ClassifyInput & { authors?: string[]; isbn13?: string | null }): Promise<ActionResult<Classification & { by: "ai" | "rules" }>> {
  try {
    const meta: ClassifyInput & { authors?: string[] } = {
      title: String(input.title ?? "").slice(0, 300),
      subtitle: input.subtitle?.slice(0, 300) ?? null,
      description: input.description?.slice(0, 3000) ?? null,
      seriesTitle: input.seriesTitle?.slice(0, 200) ?? null,
      publisher: input.publisher?.slice(0, 200) ?? null,
      ndc: input.ndc?.slice(0, 20) ?? null,
      subjects: (input.subjects ?? []).slice(0, 10).map((s) => String(s).slice(0, 100)),
      authors: (input.authors ?? []).slice(0, 10).map((s) => String(s).slice(0, 100)),
    };
    if (!meta.title) return { ok: true, data: { genre: null, tags: [], by: "rules" } };
    // 分類番号がなければ国立国会図書館から取得する
    const isbn = input.isbn13 ? parseIsbn(input.isbn13)?.isbn13 : null;
    if (!meta.ndc && isbn) {
      const ndl = await ndlProvider.lookupIsbn(isbn).catch(() => null);
      if (ndl) {
        meta.ndc = ndl.ndc ?? null;
        if (!meta.subjects?.length) meta.subjects = ndl.subjects ?? [];
        if (!meta.seriesTitle) meta.seriesTitle = ndl.seriesTitle ?? null;
      }
    }
    const draft = classifyByRules(meta);
    if ((await aiAvailable(prisma)).ok) {
      try {
        return { ok: true, data: { ...(await suggestGenreTags(meta, draft)), by: "ai" } };
      } catch (e) {
        console.warn("[classify] AI failed, using rules:", (e as Error).message);
      }
    }
    return { ok: true, data: { ...draft, by: "rules" } };
  } catch (e) {
    return toUserError(e);
  }
}
