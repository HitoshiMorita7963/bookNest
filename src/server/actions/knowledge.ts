"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import type { KnowledgeInput } from "@/lib/validators";
import * as k from "@/server/services/knowledge";

function done<T>(data: T): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function createKnowledgeAction(input: KnowledgeInput): Promise<ActionResult<{ id: string }>> {
  try {
    const note = await k.createKnowledge(prisma, input);
    return done({ id: note.id });
  } catch (e) {
    return toUserError(e);
  }
}

export async function updateKnowledgeAction(id: string, input: KnowledgeInput): Promise<ActionResult<{ id: string }>> {
  try {
    await k.updateKnowledge(prisma, id, input);
    return done({ id });
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteKnowledgeAction(id: string): Promise<ActionResult> {
  try {
    await k.deleteKnowledge(prisma, id);
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
