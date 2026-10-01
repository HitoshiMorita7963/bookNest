"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import { aiAvailable, askLibrarian } from "@/server/ai/librarian";
import { analyzeQuote, organizeNotes, summarizeTrends, type OrganizedNotes, type QuoteAnalysisResult } from "@/server/ai/features";
import { aiErrorMessage } from "@/server/ai/provider";
import type { InsightPeriod } from "@/server/services/insights";

async function guard(): Promise<ActionResult<never> | null> {
  const a = await aiAvailable(prisma);
  if (!a.ok) return { ok: false, error: `${a.reason}この機能は使えません。設定画面で AI 機能を有効にしてください。`, code: "AI_DISABLED" };
  return null;
}

export async function askLibrarianAction(conversationId: string | null, question: string) {
  try {
    const r = await askLibrarian(prisma, conversationId, question);
    revalidatePath("/ai", "layout");
    return { ok: true as const, data: r };
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteConversationAction(id: string): Promise<ActionResult> {
  try {
    await prisma.aIConversation.delete({ where: { id } });
    revalidatePath("/ai", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toUserError(e);
  }
}

export async function organizeNotesAction(bookTitle: string, text: string): Promise<ActionResult<OrganizedNotes>> {
  const g = await guard();
  if (g) return g;
  try {
    return { ok: true, data: await organizeNotes({ bookTitle, text }) };
  } catch (e) {
    const u = toUserError(e);
    return u.code === "INTERNAL" ? { ok: false, error: aiErrorMessage(e) } : u;
  }
}

export async function analyzeQuoteAction(quoteId: string): Promise<ActionResult<QuoteAnalysisResult>> {
  const g = await guard();
  if (g) return g;
  try {
    return { ok: true, data: await analyzeQuote(prisma, quoteId) };
  } catch (e) {
    const u = toUserError(e);
    return u.code === "INTERNAL" ? { ok: false, error: aiErrorMessage(e) } : u;
  }
}

export async function summarizeTrendsAction(period: InsightPeriod): Promise<ActionResult<{ overview: string; themes: string[]; suggestions: string[] }>> {
  const g = await guard();
  if (g) return g;
  try {
    return { ok: true, data: await summarizeTrends(prisma, period) };
  } catch (e) {
    return { ok: false, error: aiErrorMessage(e) };
  }
}

/** フレーズへのタグ追加・知識との関連付け（AI提案の承認） */
export async function applyQuoteSuggestionAction(quoteId: string, patch: { addTags?: string[]; linkKnowledgeIds?: string[] }): Promise<ActionResult> {
  try {
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
    if (!quote) return { ok: false, error: "フレーズが見つかりません" };
    for (const name of (patch.addTags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 10)) {
      const tag = await prisma.tag.upsert({ where: { name: name.slice(0, 100) }, create: { name: name.slice(0, 100) }, update: {} });
      await prisma.quoteTag.upsert({ where: { quoteId_tagId: { quoteId, tagId: tag.id } }, create: { quoteId, tagId: tag.id }, update: {} });
    }
    for (const knowledgeId of (patch.linkKnowledgeIds ?? []).slice(0, 10)) {
      const k = await prisma.knowledgeNote.findUnique({ where: { id: knowledgeId } });
      if (k) await prisma.quoteKnowledge.upsert({ where: { quoteId_knowledgeId: { quoteId, knowledgeId } }, create: { quoteId, knowledgeId }, update: {} });
    }
    revalidatePath("/", "layout");
    syncSheetLater("quote", quoteId);
    return { ok: true, data: undefined };
  } catch (e) {
    return toUserError(e);
  }
}

/* ---------------- AI 編集者 ---------------- */
import { applyProposal, askEditor, type EditorContext, type Proposal } from "@/server/ai/editor";
import { syncSheetLater } from "@/server/sheets-sync";

export async function askEditorAction(projectId: string, conversationId: string | null, question: string, ctx: EditorContext) {
  try {
    const r = await askEditor(prisma, projectId, conversationId, question, ctx);
    revalidatePath(`/creative/projects/${projectId}/ai`);
    return { ok: true as const, data: r };
  } catch (e) {
    return toUserError(e);
  }
}

export async function applyProposalAction(projectId: string, proposal: Proposal): Promise<ActionResult<{ kind: string; id: string }>> {
  try {
    const r = await applyProposal(prisma, projectId, proposal);
    if (r.kind === "note") syncSheetLater("note", r.id);
    revalidatePath("/", "layout");
    return { ok: true, data: r };
  } catch (e) {
    return toUserError(e);
  }
}
