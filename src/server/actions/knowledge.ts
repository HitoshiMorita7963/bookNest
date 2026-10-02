"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import type { KnowledgeInput } from "@/lib/validators";
import * as k from "@/server/services/knowledge";
import { syncSheetLater } from "@/server/sheets-sync";
import { loadCategoryContext, suggestCategoriesByRules, type CategoryInput, type CategorySuggestion } from "@/server/services/category-suggest";
import { aiAvailable } from "@/server/ai/librarian";
import { suggestKnowledgeCategories } from "@/server/ai/features";

function done<T>(data: T): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function createKnowledgeAction(input: KnowledgeInput): Promise<ActionResult<{ id: string }>> {
  try {
    const note = await k.createKnowledge(prisma, input);
    syncSheetLater("knowledge", note.id);
    return done({ id: note.id });
  } catch (e) {
    return toUserError(e);
  }
}

export async function updateKnowledgeAction(id: string, input: KnowledgeInput): Promise<ActionResult<{ id: string }>> {
  try {
    await k.updateKnowledge(prisma, id, input);
    syncSheetLater("knowledge", id);
    return done({ id });
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteKnowledgeAction(id: string): Promise<ActionResult> {
  try {
    await k.deleteKnowledge(prisma, id);
    syncSheetLater("knowledge", id);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function linkKnowledgeAction(fromId: string, toId: string, label?: string): Promise<ActionResult> {
  try {
    await k.linkKnowledge(prisma, fromId, toId, label);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function unlinkKnowledgeAction(a: string, b: string): Promise<ActionResult> {
  try {
    await k.unlinkKnowledge(prisma, a, b);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function linkQuoteKnowledgeAction(quoteId: string, knowledgeId: string): Promise<ActionResult> {
  try {
    await k.linkQuoteKnowledge(prisma, quoteId, knowledgeId);
    syncSheetLater("knowledge", knowledgeId);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function unlinkQuoteKnowledgeAction(quoteId: string, knowledgeId: string): Promise<ActionResult> {
  try {
    await k.unlinkQuoteKnowledge(prisma, quoteId, knowledgeId);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function renameKnowledgeCategoryAction(from: string | null, to: string): Promise<ActionResult<{ count: number; merged: boolean }>> {
  try {
    const r = await k.renameKnowledgeCategory(prisma, from, to);
    syncSheetLater("knowledge", ...r.ids);
    return done({ count: r.count, merged: r.merged });
  } catch (e) {
    return toUserError(e);
  }
}

export async function pickKnowledgeAction(q: string) {
  return k.pickKnowledge(prisma, q.slice(0, 100));
}

export async function pickQuotesAction(q: string) {
  const rows = await prisma.quote.findMany({
    where: q ? { OR: [{ text: { contains: q.slice(0, 100) } }, { book: { title: { contains: q.slice(0, 100) } } }] } : {},
    select: { id: true, text: true, book: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return rows;
}

/* ---------------- カテゴリの提案 ---------------- */

/** 知識の入力画面：書きかけの内容からカテゴリを提案する（AI が使えれば AI、使えなければルール） */
export async function suggestCategoryAction(input: CategoryInput): Promise<ActionResult<{ suggestions: CategorySuggestion[]; by: "ai" | "rules" }>> {
  try {
    const clean: CategoryInput = {
      title: String(input.title ?? "").slice(0, 200),
      content: String(input.content ?? "").slice(0, 3000),
      tags: (input.tags ?? []).slice(0, 20).map((t) => String(t).slice(0, 50)),
      bookIds: (input.bookIds ?? []).slice(0, 20),
      quoteIds: (input.quoteIds ?? []).slice(0, 20),
      excludeId: input.excludeId ?? null,
    };
    if (!clean.title.trim() && !clean.content?.trim()) return { ok: false, error: "タイトルか内容を入力すると提案できます" };
    const ctx = await loadCategoryContext(prisma);
    const rules = await suggestCategoriesByRules(prisma, clean, ctx);
    if ((await aiAvailable(prisma)).ok) {
      try {
        const books = clean.bookIds?.length ? await prisma.book.findMany({ where: { id: { in: clean.bookIds } }, select: { title: true } }) : [];
        const facets = await k.knowledgeFacets(prisma);
        const ai = await suggestKnowledgeCategories(
          [{ id: "this", title: clean.title, content: clean.content ?? "", tags: clean.tags ?? [], books: books.map((b) => b.title), hints: rules.map((r) => r.name) }],
          facets.categories,
        );
        const cats = ai.get("this") ?? [];
        if (cats.length) return { ok: true, data: { by: "ai", suggestions: cats.map((c) => ({ ...c, existing: ctx.existing.includes(c.name) })) } };
      } catch (e) {
        console.warn("[category] AI failed, using rules:", (e as Error).message);
      }
    }
    return { ok: true, data: { suggestions: rules, by: "rules" } };
  } catch (e) {
    return toUserError(e);
  }
}

/** 未分類の知識：まとめてカテゴリを提案する（一度に30件まで） */
export async function suggestCategoriesForUncategorizedAction(): Promise<
  ActionResult<{ items: { id: string; title: string; suggestions: CategorySuggestion[] }[]; by: "ai" | "rules"; total: number }>
> {
  try {
    const ctx = await loadCategoryContext(prisma);
    const uncategorized = ctx.notes.filter((n) => !n.category?.trim());
    const target = uncategorized.slice(0, 30);
    const items = await Promise.all(
      target.map(async (n) => ({
        id: n.id,
        title: n.title,
        suggestions: await suggestCategoriesByRules(
          prisma,
          { title: n.title, content: n.content, tags: n.tags.map((t) => t.tag.name), bookIds: n.books.map((b) => b.bookId), quoteIds: n.quotes.map((q) => q.quoteId), excludeId: n.id },
          ctx,
        ),
      })),
    );
    if (items.length && (await aiAvailable(prisma)).ok) {
      try {
        const bookTitles = new Map(
          (await prisma.book.findMany({ where: { id: { in: target.flatMap((n) => n.books.map((b) => b.bookId)) } }, select: { id: true, title: true } })).map((b) => [b.id, b.title]),
        );
        const facets = await k.knowledgeFacets(prisma);
        const ai = await suggestKnowledgeCategories(
          target.map((n, i) => ({
            id: n.id,
            title: n.title,
            content: n.content,
            tags: n.tags.map((t) => t.tag.name),
            books: n.books.map((b) => bookTitles.get(b.bookId) ?? "").filter(Boolean),
            hints: items[i].suggestions.map((s) => s.name),
          })),
          facets.categories,
        );
        const merged = items.map((it) => {
          const cats = ai.get(it.id);
          return cats?.length ? { ...it, suggestions: cats.map((c) => ({ ...c, existing: ctx.existing.includes(c.name) })) } : it;
        });
        return { ok: true, data: { items: merged, by: "ai", total: uncategorized.length } };
      } catch (e) {
        console.warn("[category] AI failed, using rules:", (e as Error).message);
      }
    }
    return { ok: true, data: { items, by: "rules", total: uncategorized.length } };
  } catch (e) {
    return toUserError(e);
  }
}

/** 選んだカテゴリを複数の知識にまとめて設定する */
export async function applyCategoriesAction(assignments: { id: string; category: string }[]): Promise<ActionResult<{ count: number }>> {
  try {
    const list = assignments
      .slice(0, 100)
      .map((a) => ({ id: String(a.id), category: String(a.category).normalize("NFKC").trim().slice(0, 60) }))
      .filter((a) => a.category);
    await prisma.$transaction(list.map((a) => prisma.knowledgeNote.update({ where: { id: a.id }, data: { category: a.category } })));
    syncSheetLater("knowledge", ...list.map((a) => a.id));
    return done({ count: list.length });
  } catch (e) {
    return toUserError(e);
  }
}
