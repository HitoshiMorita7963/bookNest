"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
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
