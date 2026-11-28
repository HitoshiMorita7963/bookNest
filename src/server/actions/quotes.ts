"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import { creativeUsesSchema, type CreativeUse, type QuoteInput } from "@/lib/validators";
import * as quotes from "@/server/services/quotes";
import { applyCreativeUses } from "@/server/services/creative-uses";
import { syncSheetLater } from "@/server/sheets-sync";

function done<T>(data: T): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, data };
}

/** uses：登録画面で予約した「創作に使う」。フレーズを保存したあとで実行する */
export async function createQuoteAction(input: QuoteInput, uses: CreativeUse[] = []): Promise<ActionResult<{ id: string; failedUses: number }>> {
  try {
    // 予約の形が正しくなければ、フレーズも保存しない
    const planned = creativeUsesSchema.parse(uses);
    const q = await quotes.createQuote(prisma, input);
    const { failed, noteIds } = planned.length ? await applyCreativeUses(prisma, { kind: "quote", id: q.id }, planned) : { failed: 0, noteIds: [] };
    syncSheetLater("quote", q.id);
    syncSheetLater("note", ...noteIds);
    return done({ id: q.id, failedUses: failed });
  } catch (e) {
    return toUserError(e);
  }
}

export async function updateQuoteAction(id: string, input: QuoteInput): Promise<ActionResult<{ id: string }>> {
  try {
    await quotes.updateQuote(prisma, id, input);
    syncSheetLater("quote", id);
    return done({ id });
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteQuoteAction(id: string): Promise<ActionResult> {
  try {
    await quotes.deleteQuote(prisma, id);
    syncSheetLater("quote", id);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function toggleFavoriteAction(id: string): Promise<ActionResult> {
  try {
    await quotes.toggleFavorite(prisma, id);
    syncSheetLater("quote", id);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function listTagNamesAction() {
  const tags = await prisma.tag.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 300 });
  return tags.map((t) => t.name);
}
