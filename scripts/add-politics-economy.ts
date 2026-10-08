/**
 * 政治・経済の基礎知識と、要点・最近の話題のフレーズを追加する。
 *
 *   npx tsx --env-file=.env scripts/add-politics-economy.ts            … 確認のみ（書き込まない）
 *   npx tsx --env-file=.env scripts/add-politics-economy.ts --apply    … バックアップを保存してから追加する
 *   --local を付けると、クラウド（Turso）ではなく PC のローカル DB を対象にする
 *
 * 何度実行しても重複しない（同じタイトルの知識・同じ本文のフレーズ・同じつながりは作らない）。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { exportJson } from "../src/server/services/backup";
import { createKnowledge, linkKnowledge } from "../src/server/services/knowledge";
import { createQuote } from "../src/server/services/quotes";
import { PE_KNOWLEDGE, PE_LINKS, PE_TOPICS } from "./data/politics-economy";

const POINT_NOTE = "要点（本文の引用ではなく、BookNestで要約した基礎知識）";
const TOPIC_NOTE = (sources: string[]) => `時事（2026年10月8日時点のWeb情報をもとにBookNestで要約。最新の状況は報道で確認を）\n出典：${sources.join("、")}`;

async function retry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 4) throw e;
      console.log(`  … ${label} を再試行します（${attempt}回目）：${e instanceof Error ? e.message || e.name : String(e)}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

async function main() {
  const local = process.argv.includes("--local");
  const apply = process.argv.includes("--apply");
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!local && !url) throw new Error(".env に TURSO_DATABASE_URL が設定されていません");
  const db = local ? new PrismaClient({ datasourceUrl: process.env.DATABASE_URL }) : new PrismaClient({ adapter: new PrismaLibSQL({ url: url!, authToken: process.env.TURSO_AUTH_TOKEN?.trim() }) });
  console.log(`対象：${local ? "PC のローカル DB" : "クラウド（Turso）"}${apply ? "（追加します）" : "（確認のみ・書き込みません）"}`);

  // 事前チェック：話題・つながりが指す知識がすべてあるか
  const newTitles = new Set(PE_KNOWLEDGE.map((k) => k.title));
  const existing = await db.knowledgeNote.findMany({ select: { id: true, title: true } });
  const idByTitle = new Map(existing.map((k) => [k.title, k.id]));
  const missingTopicLinks = PE_TOPICS.flatMap((t) => t.links).filter((t) => !newTitles.has(t) && !idByTitle.has(t));
  const missingLinks = PE_LINKS.flatMap(([a, b]) => [a, b]).filter((t) => !newTitles.has(t) && !idByTitle.has(t));
  if (missingTopicLinks.length) throw new Error(`話題のつなぎ先が見つかりません：${[...new Set(missingTopicLinks)].join("、")}`);
  if (missingLinks.length) console.log(`※ 見つからない既存の知識（このつながりは作りません）：${[...new Set(missingLinks)].join("、")}`);

  const toCreate = PE_KNOWLEDGE.filter((k) => !idByTitle.has(k.title));
  const existingTexts = new Set((await db.quote.findMany({ select: { text: true } })).map((q) => q.text));
  const newPoints = PE_KNOWLEDGE.filter((k) => !existingTexts.has(k.point));
  const newTopics = PE_TOPICS.filter((t) => !existingTexts.has(t.text));
  const links = PE_LINKS.filter(([a, b]) => (newTitles.has(a) || idByTitle.has(a)) && (newTitles.has(b) || idByTitle.has(b)));
  console.log(`知識 ${toCreate.length} 件（政治 ${toCreate.filter((k) => k.category === "政治の基礎").length}・経済 ${toCreate.filter((k) => k.category === "経済の基礎").length}）`);
  console.log(`要点フレーズ ${newPoints.length} 件・最近の話題 ${newTopics.length} 件・知識同士のつながり 最大 ${links.length} 件`);
  for (const t of newTopics.slice(0, 3)) console.log(`  例）${t.text}`);
  if (!apply) return void (await db.$disconnect());

  const dir = path.join(process.cwd(), "data", "backups");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `before-politics-economy-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(await exportJson(db, { includeAi: true })));
  console.log(`✓ バックアップを保存しました：${path.relative(process.cwd(), file)}`);

  for (const k of toCreate) {
    const note = await retry(() => createKnowledge(db, { title: k.title, content: k.content, category: k.category, tags: k.tags }), "知識の追加");
    idByTitle.set(k.title, note.id);
  }
  console.log(`✓ 知識 ${toCreate.length} 件`);

  const addQuote = async (text: string, note: string, tags: string[], knowledgeTitles: string[]) => {
    const q = await retry(async () => (await db.quote.findFirst({ where: { text } })) ?? (await createQuote(db, { text, note, tags })), "フレーズの追加");
    for (const t of knowledgeTitles) {
      const knowledgeId = idByTitle.get(t)!;
      await retry(() => db.quoteKnowledge.upsert({ where: { quoteId_knowledgeId: { quoteId: q.id, knowledgeId } }, create: { quoteId: q.id, knowledgeId }, update: {} }), "知識へのつなぎ");
    }
  };
  for (const k of newPoints) await addQuote(k.point, POINT_NOTE, ["要点", k.category === "政治の基礎" ? "政治" : "経済"], [k.title]);
  console.log(`✓ 要点フレーズ ${newPoints.length} 件`);
  const categoryOf = (title: string) => PE_KNOWLEDGE.find((k) => k.title === title)?.category;
  for (const t of newTopics) {
    const field = t.links.some((l) => categoryOf(l) === "政治の基礎") && !t.links.some((l) => categoryOf(l) === "経済の基礎") ? "政治" : t.links.every((l) => categoryOf(l) === "経済の基礎") ? "経済" : "政治経済";
    await addQuote(t.text, TOPIC_NOTE(t.sources), ["時事", "2026年10月", field], t.links);
  }
  console.log(`✓ 最近の話題 ${newTopics.length} 件`);

  let linked = 0;
  for (const [a, b, label] of links) {
    const from = idByTitle.get(a);
    const to = idByTitle.get(b);
    if (!from || !to) continue;
    const exists = await db.knowledgeLink.count({ where: { OR: [{ fromId: from, toId: to }, { fromId: to, toId: from }] } });
    if (exists) continue;
    await retry(() => linkKnowledge(db, from, to, label || null), "つながりの追加");
    linked++;
  }
  console.log(`✓ 知識同士のつながり ${linked} 件`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("✗ 失敗しました:", e instanceof Error ? e.message || e.stack || e.name : e);
  process.exit(1);
});
