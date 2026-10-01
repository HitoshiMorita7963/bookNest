import { z } from "zod";
import type { Db } from "@/lib/db";

export const settingsSchema = z.object({
  /** AI 機能の利用（読書データを AI プロバイダへ送信する）への同意。既定はオフ */
  aiEnabled: z.boolean().default(false),
  /** 年間目標をホームに表示する等、将来の拡張用 */
  defaultOcrDirection: z.enum(["auto", "horizontal", "vertical"]).default("auto"),
});
export type AppSettings = z.infer<typeof settingsSchema>;

export async function getUser(db: Db) {
  return db.user.upsert({ where: { id: "me" }, create: { id: "me" }, update: {} });
}

export async function getSettings(db: Db): Promise<AppSettings> {
  const u = await getUser(db);
  try {
    return settingsSchema.parse(JSON.parse(u.settings || "{}"));
  } catch {
    return settingsSchema.parse({});
  }
}

export async function updateSettings(db: Db, patch: Partial<AppSettings>) {
  const current = await getSettings(db);
  const next = settingsSchema.parse({ ...current, ...patch });
  await db.user.update({ where: { id: "me" }, data: { settings: JSON.stringify(next) } });
  return next;
}

export async function updateProfile(db: Db, input: { name: string; bio?: string | null }) {
  const data = z.object({ name: z.string().trim().max(40), bio: z.string().trim().max(500).nullish() }).parse(input);
  await getUser(db);
  return db.user.update({ where: { id: "me" }, data: { name: data.name, bio: data.bio || null } });
}
