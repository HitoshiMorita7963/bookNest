"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import { updateAuthor, updateSeries } from "@/server/services/authors";

export async function updateAuthorAction(id: string, input: { name: string; nameKana?: string; profile?: string }): Promise<ActionResult> {
  try {
    await updateAuthor(prisma, id, input);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toUserError(e);
  }
}

export async function updateSeriesAction(id: string, input: { title: string; description?: string; totalVolumes?: string | number | null }): Promise<ActionResult> {
  try {
    await updateSeries(prisma, id, input);
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (e) {
    return toUserError(e);
  }
}
