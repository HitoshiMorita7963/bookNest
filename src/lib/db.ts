import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * DB クライアント
 * - TURSO_DATABASE_URL が設定されていればクラウドの Turso（libSQL）に接続（本番・Vercel）
 * - それ以外は DATABASE_URL のローカル SQLite ファイルを使う（PC での利用・開発・テスト）
 */
function createClient() {
  const log: ("warn" | "error")[] = process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    // スキーマの datasource は DATABASE_URL を参照するため、アダプタ使用時は未設定でも動くようにダミーを入れる（実際には使われない）
    process.env.DATABASE_URL ||= "file:./unused.db";
    const adapter = new PrismaLibSQL({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
    return new PrismaClient({ adapter, log });
  }
  return new PrismaClient({ log });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type Db = PrismaClient;
