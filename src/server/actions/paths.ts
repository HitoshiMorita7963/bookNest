"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import * as paths from "@/server/services/paths";

function done<T>(data: T): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function createPathAction(input: { title: string; description?: string; bookIds?: string[] }): Promise<ActionResult<{ id: string }>> {
  try {
    const p = await paths.createPath(prisma, input);
    return done({ id: p.id });
  } catch (e) {
    return toUserError(e);
  }
}

export async function updatePathAction(id: string, input: { title: string; description?: string }): Promise<ActionResult> {
  try {
    await paths.updatePath(prisma, id, input);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function deletePathAction(id: string): Promise<ActionResult> {
  try {
    await paths.deletePath(prisma, id);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function addBookToPathAction(pathId: string, bookId: string): Promise<ActionResult> {
  try {
    await paths.addBookToPath(prisma, pathId, bookId);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function removeBookFromPathAction(pathId: string, bookId: string): Promise<ActionResult> {
  try {
    await paths.removeBookFromPath(prisma, pathId, bookId);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function moveBookInPathAction(pathId: string, bookId: string, direction: -1 | 1): Promise<ActionResult> {
  try {
    await paths.moveBookInPath(prisma, pathId, bookId, direction === -1 ? -1 : 1);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}
