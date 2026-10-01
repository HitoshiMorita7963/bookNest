"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import type { QuoteInput } from "@/lib/validators";
import * as quotes from "@/server/services/quotes";
import { syncSheetLater } from "@/server/sheets-sync";

function done<T>(data: T): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function createQuoteAction(input: QuoteInput): Promise<ActionResult<{ id: string }>> {
  try {
    const q = await quotes.createQuote(prisma, input);
    syncSheetLater("quote", q.id);
    return done({ id: q.id });
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
