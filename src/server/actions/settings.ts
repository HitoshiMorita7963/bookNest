"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import { updateProfile, updateSettings, type AppSettings } from "@/server/services/settings";
import { previewImport, runImport, deleteAllData } from "@/server/services/backup";
import { deleteSampleData, loadSampleData } from "@/server/services/sample";

function done<T>(data: T): ActionResult<T> {
  revalidatePath("/", "layout");
  return { ok: true, data };
}

export async function updateProfileAction(input: { name: string; bio?: string }): Promise<ActionResult> {
  try {
    await updateProfile(prisma, input);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function updateSettingsAction(patch: Partial<AppSettings>): Promise<ActionResult<AppSettings>> {
  try {
    return done(await updateSettings(prisma, patch));
  } catch (e) {
    return toUserError(e);
  }
}

const MAX_IMPORT = 10 * 1024 * 1024;

export async function previewImportAction(text: string): Promise<ActionResult<Awaited<ReturnType<typeof previewImport>>>> {
  try {
    if (text.length > MAX_IMPORT) return { ok: false, error: "ファイルが大きすぎます（10MBまで）" };
    return { ok: true, data: await previewImport(prisma, text) };
  } catch (e) {
    return toUserError(e);
  }
}

export async function runImportAction(text: string): Promise<ActionResult<Record<string, number>>> {
  try {
    if (text.length > MAX_IMPORT) return { ok: false, error: "ファイルが大きすぎます（10MBまで）" };
    return done(await runImport(prisma, text));
  } catch (e) {
    return toUserError(e);
  }
}

export async function loadSampleAction(): Promise<ActionResult<{ created: boolean }>> {
  try {
    return done(await loadSampleData(prisma));
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteSampleAction(): Promise<ActionResult> {
  try {
    await deleteSampleData(prisma);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteAllDataAction(confirmText: string): Promise<ActionResult> {
  if (confirmText !== "削除") return { ok: false, error: "確認のため「削除」と入力してください" };
  try {
    await deleteAllData(prisma);
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}
