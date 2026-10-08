/**
 * 重なっている知識を統合する（2026-10-08 にユーザーが選んだ組）。
 *
 *   npx tsx --env-file=.env scripts/merge-knowledge.ts            … 計画を表示するだけ（書き込まない）
 *   npx tsx --env-file=.env scripts/merge-knowledge.ts --apply    … バックアップを保存してから統合する
 *   --local を付けると、クラウド（Turso）ではなく PC のローカル DB を対象にする
 *
 * 統合済みの組は飛ばすので、何度実行しても同じ結果になる。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { exportJson } from "../src/server/services/backup";
import { mergeKnowledge } from "../src/server/services/knowledge";

/** [統合先, 統合する知識, 統合後のタイトル] */
const GROUPS: [string, string[], string][] = [
  // A. 内容がほぼ重なっているもの
  ["エネルギー地政学", ["中東情勢とエネルギー"], "エネルギー地政学"],
  ["防衛", ["防衛費と防衛政策", "自衛隊"], "防衛（防衛費・防衛産業・自衛隊）"],
  ["証券", ["投資(株式・FX)"], "証券・個人投資（株式・FX）"],
  ["AI(海外)", ["AI(国内)"], "AI（生成AI・海外と国内）"],
  ["鉄鋼(高炉)", ["鉄鋼(電炉)"], "鉄鋼（高炉・電炉）"],
  ["石油・資源(世界)", ["石油(国内)", "原油価格と経済"], "石油・資源（世界・国内）"],
  ["鉄道(JR)", ["鉄道(私鉄)"], "鉄道（JR・私鉄）"],
  ["外食(ファミレス・すし・居酒屋)", ["外食(ファストフード・麺類)"], "外食"],
  ["専門商社(製造系)", ["専門商社(流通系)"], "専門商社"],
  ["ソフトウェア(業務特化)", ["ソフトウェア(業界特化)"], "ソフトウェア（SaaS）"],
  ["中央銀行と金融政策", ["政策金利"], "金融政策と政策金利"],
  ["為替レート（円安・円高）", ["為替介入"], "為替（円安・円高と為替介入）"],
  // B. 分野が近いもの
  ["米国(GAFAM・IT)", ["米国(製造・運輸)", "米国(流通・消費)"], "米国（IT・製造・消費）"],
  ["自動車(世界)", ["自動車(中国)"], "自動車（世界・中国）"],
  ["医薬品", ["後発薬"], "医薬品（新薬・後発薬）"],
  ["国会（衆議院と参議院）", ["衆議院の優越", "国会の会期（通常・臨時・特別国会）"], "国会（二院制・衆議院の優越・会期）"],
  ["財政政策", ["財政赤字とプライマリーバランス"], "財政（財政政策と財政赤字）"],
  ["マンション", ["マンション管理"], "マンション（供給と管理）"],
  // 本文が空の知識
  ["マルクス", ["エンゲルス"], "マルクス"],
];

async function main() {
  const local = process.argv.includes("--local");
  const apply = process.argv.includes("--apply");
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!local && !url) throw new Error(".env に TURSO_DATABASE_URL が設定されていません");
  const db = local ? new PrismaClient({ datasourceUrl: process.env.DATABASE_URL }) : new PrismaClient({ adapter: new PrismaLibSQL({ url: url!, authToken: process.env.TURSO_AUTH_TOKEN?.trim() }) });
  console.log(`対象：${local ? "PC のローカル DB" : "クラウド（Turso）"}${apply ? "（統合します）" : "（確認のみ・書き込みません）"}`);

  const notes = await db.knowledgeNote.findMany({ select: { id: true, title: true, _count: { select: { quotes: true, books: true } } } });
  const byTitle = new Map(notes.map((n) => [n.title, n]));
  const plan: { into: (typeof notes)[number]; froms: (typeof notes)[number][]; title: string }[] = [];
  for (const [intoTitle, fromTitles, title] of GROUPS) {
    const into = byTitle.get(intoTitle) ?? byTitle.get(title);
    const froms = fromTitles.map((t) => byTitle.get(t)).filter((n): n is NonNullable<typeof n> => !!n);
    if (!into) {
      console.log(`  ※ 統合先が見つかりません：${intoTitle}`);
      continue;
    }
    if (!froms.length) {
      console.log(`  ・統合済み：${title}`);
      continue;
    }
    plan.push({ into, froms, title });
    const missing = fromTitles.filter((t) => !byTitle.has(t));
    console.log(`  ${[into, ...froms].map((n) => `${n.title}（フレーズ${n._count.quotes}）`).join(" ＋ ")} → ${title}${missing.length ? `（見つからない：${missing.join("、")}）` : ""}`);
  }
  const removed = plan.reduce((n, p) => n + p.froms.length, 0);
  console.log(`統合 ${plan.length} 組・知識 ${notes.length} 件 → ${notes.length - removed} 件`);

  if (apply && plan.length) {
    const dir = path.join(process.cwd(), "data", "backups");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `before-merge-knowledge-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify(await exportJson(db, { includeAi: true })));
    console.log(`✓ バックアップを保存しました：${path.relative(process.cwd(), file)}`);
    for (const p of plan) {
      await mergeKnowledge(db, p.into.id, p.froms.map((f) => f.id), { title: p.title });
      console.log(`  ✓ ${p.title}`);
    }
    console.log(`✓ 統合しました。知識は ${await db.knowledgeNote.count()} 件になりました`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error("✗ 失敗しました:", e instanceof Error ? e.message || e.stack || e.name : e);
  process.exit(1);
});
