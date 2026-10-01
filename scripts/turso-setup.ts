/**
 * クラウド DB（Turso）の準備
 *   1. prisma/migrations の SQL を Turso に適用（未適用のものだけ）
 *   2. --copy-local を付けると、PC のローカル DB のデータを Turso にコピー（重複は取り込まない）
 *
 * 使い方（.env に TURSO_DATABASE_URL と TURSO_AUTH_TOKEN を書いてから）:
 *   npm run cloud:setup
 *   npm run cloud:copy
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { exportJson, runImport } from "../src/server/services/backup";

async function main() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url) {
    console.error("✗ .env に TURSO_DATABASE_URL が設定されていません");
    process.exit(1);
  }
  const client = createClient({ url, authToken });
  await client.execute("CREATE TABLE IF NOT EXISTS _booknest_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set((await client.execute("SELECT name FROM _booknest_migrations")).rows.map((r) => String(r.name)));
  const dir = path.join(process.cwd(), "prisma", "migrations");
  const migrations = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();
  for (const name of migrations) {
    if (applied.has(name)) continue;
    const sql = readFileSync(path.join(dir, name, "migration.sql"), "utf8");
    await client.executeMultiple(sql);
    await client.execute({ sql: "INSERT INTO _booknest_migrations (name, applied_at) VALUES (?, ?)", args: [name, new Date().toISOString()] });
    console.log(`✓ テーブルを作成・更新しました: ${name}`);
  }
  console.log("✓ クラウド DB の準備ができています");

  if (process.argv.includes("--copy-local")) {
    const local = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
    const cloud = new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken }) });
    const data = await exportJson(local, { includeAi: true });
    const counts = Object.fromEntries(Object.entries(data.tables).map(([k, v]) => [k, v?.length ?? 0]));
    console.log("PC のデータ:", `本 ${counts.book} / フレーズ ${counts.quote} / 知識 ${counts.knowledgeNote} / 読書記録 ${counts.readingRecord}`);
    const created = await runImport(cloud, JSON.stringify(data));
    const n = Object.values(created).reduce((a, b) => a + b, 0);
    console.log(`✓ ${n} 件をクラウドにコピーしました（すでにあるデータは重複して登録されません）`);
    console.log("※ PC にアップロードした画像（自分で撮った表紙・フレーズの元画像）はコピーされません");
    await local.$disconnect();
    await cloud.$disconnect();
  }
  client.close();
}

main().catch((e) => {
  console.error("✗ 失敗しました:", e instanceof Error ? e.message : e);
  process.exit(1);
});
