"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import * as shelves from "@/server/services/shelves";

function done<T>(data: T): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function listShelvesAction() {
  const rows = await prisma.customShelf.findMany({ orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, name: true } });
  return rows;
}

export async function createShelfAction(input: { name: string; description?: string | null }): Promise<ActionResult<{ id: string }>> {
  try {
    const s = await shelves.createShelf(prisma, input);
    return done({ id: s.id });
  } catch (e) {
    return toUserError(e);
  }
}

export async function updateShelfAction(id: string, input: { name: string; description?: string | null }): Promise<ActionResult> {
  try {
    await shelves.updateShelf(prisma, id, input);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteShelfAction(id: string): Promise<ActionResult> {
  try {
    await shelves.deleteShelf(prisma, id);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function setBookShelvesAction(bookId: string, shelfIds: string[]): Promise<ActionResult> {
  try {
    await shelves.setBookShelves(prisma, bookId, shelfIds.slice(0, 200));
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function removeBookFromShelfAction(shelfId: string, bookId: string): Promise<ActionResult> {
  try {
    await shelves.removeBookFromShelf(prisma, shelfId, bookId);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function addBookToShelfAction(shelfId: string, bookId: string): Promise<ActionResult> {
  try {
    await shelves.addBookToShelf(prisma, shelfId, bookId);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}
