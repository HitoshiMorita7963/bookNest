/**
 * 著者名のスペースをそろえる（全角・スペースなし → 半角スペース1つ。表記違いの同じ著者はまとめる）
 *
 *   npx tsx --env-file=.env scripts/normalize-authors.ts            … 計画を表示するだけ（書き込まない）
 *   npx tsx --env-file=.env scripts/normalize-authors.ts --apply    … バックアップを保存してから書き換える
 *   --local を付けると、クラウド（Turso）ではなく PC のローカル DB を対象にする
 *
 * スペースのない日本語の名前は、本の ISBN で国立国会図書館の表記を調べ、スペースありの表記が見つかったときだけ直す。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { exportJson } from "../src/server/services/backup";
import { applyAuthorNameCleanup, planAuthorNameCleanup } from "../src/server/services/authors";
import { ndlLookup } from "../src/server/services/metadata";

async function main() {
  const local = process.argv.includes("--local");
  const apply = process.argv.includes("--apply");
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!local && !url) throw new Error(".env に TURSO_DATABASE_URL が設定されていません");
  const db = local ? new PrismaClient({ datasourceUrl: process.env.DATABASE_URL }) : new PrismaClient({ adapter: new PrismaLibSQL({ url: url!, authToken: process.env.TURSO_AUTH_TOKEN?.trim() }) });
  console.log(`対象：${local ? "PC のローカル DB" : "クラウド（Turso）"}${apply ? "（書き換えます）" : "（確認のみ・書き込みません）"}`);

  const plan = await planAuthorNameCleanup(db, {
    lookupNdl: async (isbn) => (await ndlLookup(isbn, 20_000))?.authors ?? [],
  });
  console.log(`著者 ${plan.total} 人のうち、変更 ${plan.changes.length} 件`);
  for (const c of plan.changes) console.log(`  ${c.kind === "merge" ? "まとめる" : "名前を直す"}：${c.from} → ${c.to}（${c.reason}）`);
  if (plan.unresolved.length) {
    console.log(`スペースの位置がわからないため、そのままにする名前 ${plan.unresolved.length} 件：`);
    for (const u of plan.unresolved) console.log(`  ${u.name}（本 ${u.books} 冊）`);
  }

  if (apply && plan.changes.length) {
    const dir = path.join(process.cwd(), "data", "backups");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `before-author-names-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify(await exportJson(db, { includeAi: true })));
    console.log(`✓ バックアップを保存しました：${path.relative(process.cwd(), file)}`);
    const result = await applyAuthorNameCleanup(db, plan.changes);
    console.log(`✓ 名前を直した ${result.renamed} 件・まとめた ${result.merged} 件`);
    console.log(`✓ 著者は ${await db.author.count()} 人になりました`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error("✗ 失敗しました:", e instanceof Error ? e.message : e);
  process.exit(1);
});
