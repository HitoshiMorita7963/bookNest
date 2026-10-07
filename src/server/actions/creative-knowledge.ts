"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { NotFoundError, toUserError, type ActionResult } from "@/lib/errors";
import type { CreativeKnowledgeInput } from "@/lib/validators";
import * as ck from "@/server/services/creative-knowledge";
import * as refs from "@/server/services/creative-knowledge-references";
import type { CkReferenceKind } from "@/lib/creative-knowledge";

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

/* ---------------- 参考にした読書 ---------------- */

export async function addCkReferenceAction(input: refs.CkReferenceInput) {
  return run(async () => void (await refs.addCkReference(prisma, input)));
}

export async function updateCkReferenceAction(id: string, input: { location?: string | null; comment?: string | null }) {
  return run(async () => void (await refs.updateCkReference(prisma, id, input)));
}

export async function removeCkReferenceAction(id: string) {
  return run(() => refs.removeCkReference(prisma, id));
}

/** 読書データから「創作知識として保存」 */
export async function createCkFromSourceAction(
  input: CreativeKnowledgeInput,
  ref: { source: { kind: CkReferenceKind; id: string }; location?: string | null; comment?: string | null },
) {
  return run(async () => ({ id: (await refs.createCreativeKnowledgeFromSource(prisma, input, ref)).id }));
}

export async function pickReadingSourcesAction(q: string) {
  return refs.pickReadingSources(prisma, q.slice(0, 60));
}
