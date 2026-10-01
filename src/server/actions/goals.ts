"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import * as goals from "@/server/services/goals";

function done(): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function createGoalAction(input: { type: string; year: number; month?: number | null; genre?: string | null; target: number | string }): Promise<ActionResult> {
  try {
    await goals.createGoal(prisma, input);
    return done();
  } catch (e) {
    return toUserError(e);
  }
}

export async function updateGoalTargetAction(id: string, target: number): Promise<ActionResult> {
  try {
    await goals.updateGoalTarget(prisma, id, target);
    return done();
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteGoalAction(id: string): Promise<ActionResult> {
  try {
    await goals.deleteGoal(prisma, id);
    return done();
  } catch (e) {
    return toUserError(e);
  }
}
