"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { NotFoundError, toUserError, type ActionResult } from "@/lib/errors";
import type { CreativeKnowledgeInput } from "@/lib/validators";
import * as ck from "@/server/services/creative-knowledge";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (e) {
    return toUserError(e);
  }
}

export async function createCreativeKnowledgeAction(input: CreativeKnowledgeInput) {
  return run(async () => ({ id: (await ck.createCreativeKnowledge(prisma, input)).id }));
}

export async function updateCreativeKnowledgeAction(id: string, input: CreativeKnowledgeInput) {
  return run(async () => ({ id: (await ck.updateCreativeKnowledge(prisma, id, input)).id }));
}

export async function deleteCreativeKnowledgeAction(id: string) {
  return run(() => ck.deleteCreativeKnowledge(prisma, id));
}

/* ---------------- 知識同士の関係 ---------------- */

export async function addCkRelationAction(input: { fromId: string; toId: string; type: string; note?: string | null }) {
  return run(async () => void (await ck.addCkRelation(prisma, input)));
}

export async function removeCkRelationAction(id: string) {
  return run(() => ck.removeCkRelation(prisma, id));
}

/** まだない知識をタイトルだけで作って、すぐにつなげる（中身はあとで書く） */
export async function createAndRelateCkAction(fromId: string, title: string, type: string) {
  return run(async () => {
    const from = await prisma.creativeKnowledge.findUnique({ where: { id: fromId }, select: { category: true } });
    if (!from) throw new NotFoundError("創作知識");
    const created = await ck.createCreativeKnowledge(prisma, { title, category: from.category as CreativeKnowledgeInput["category"] });
    await ck.addCkRelation(prisma, { fromId, toId: created.id, type });
    return { id: created.id };
  });
}

export async function pickCreativeKnowledgeAction(q: string, excludeId?: string) {
  return ck.pickCreativeKnowledge(prisma, q, excludeId);
}
