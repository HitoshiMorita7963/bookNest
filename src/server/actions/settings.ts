"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { toUserError, type ActionResult } from "@/lib/errors";
import { updateProfile, updateSettings, type AppSettings } from "@/server/services/settings";
import { previewImport, runImport, deleteAllData } from "@/server/services/backup";
import { deleteSampleData, loadSampleData } from "@/server/services/sample";
import { syncAllLater } from "@/server/sheets-sync";
import { postToSheets, sheetsConfigured, syncAll } from "@/server/services/sheets";
import { fillMissingCovers } from "@/server/services/covers";

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
    const r = await runImport(prisma, text);
    syncAllLater();
    return done(r);
  } catch (e) {
    return toUserError(e);
  }
}

export async function loadSampleAction(): Promise<ActionResult<{ created: boolean }>> {
  try {
    const r = await loadSampleData(prisma);
    syncAllLater();
    return done(r);
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteSampleAction(): Promise<ActionResult> {
  try {
    await deleteSampleData(prisma);
    syncAllLater();
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

export async function deleteAllDataAction(confirmText: string): Promise<ActionResult> {
  if (confirmText !== "削除") return { ok: false, error: "確認のため「削除」と入力してください" };
  try {
    await deleteAllData(prisma);
    syncAllLater();
    return done(undefined);
  } catch (e) {
    return toUserError(e);
  }
}

/* ---------------- スプレッドシート連携 ---------------- */

export async function testSheetsAction(): Promise<ActionResult> {
  if (!sheetsConfigured()) return { ok: false, error: "スプレッドシート連携が設定されていません（SHEETS_WEBHOOK_URL / SHEETS_WEBHOOK_SECRET）" };
  try {
    await postToSheets({ action: "ping" });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: (e as Error).message || "接続できませんでした" };
  }
}

export async function syncSheetsNowAction(): Promise<ActionResult<{ quote: number; knowledge: number; note: number }>> {
  if (!sheetsConfigured()) return { ok: false, error: "スプレッドシート連携が設定されていません（SHEETS_WEBHOOK_URL / SHEETS_WEBHOOK_SECRET）" };
  try {
    return { ok: true, data: await syncAll(prisma) };
  } catch (e) {
    console.error("[sheets]", e);
    return { ok: false, error: (e as Error).message || "書き出しに失敗しました" };
  }
}

/* ---------------- 表紙の一括取得 ---------------- */

export async function fillCoversAction(skipIds: string[]): Promise<ActionResult<{ processed: number; found: number; notFoundIds: string[]; remaining: number }>> {
  try {
    const r = await fillMissingCovers(prisma, { limit: 8, skipIds: skipIds.slice(0, 2000) });
    if (r.found) revalidatePath("/", "layout");
    return { ok: true, data: r };
  } catch (e) {
    return toUserError(e);
  }
}
