/**
 * 業界地図の193業界に「要点フレーズ」を追加し、業界の知識を創作知識の「参考にした読書」としてつなげる。
 *
 *   npx tsx --env-file=.env scripts/add-industry-points.ts            … 確認のみ（書き込まない）
 *   npx tsx --env-file=.env scripts/add-industry-points.ts --apply    … バックアップを保存してから追加する
 *   --local を付けると、クラウド（Turso）ではなく PC のローカル DB を対象にする
 *
 * 何度実行しても重複しない（同じ本文のフレーズ・同じ参考は作らない）。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { exportJson } from "../src/server/services/backup";
import { createQuote } from "../src/server/services/quotes";
import { addCkReference } from "../src/server/services/creative-knowledge-references";
import { INDUSTRY_POINTS } from "./data/industry-points";

const NOTE = "要点（本文の引用ではなく、登録済みの知識をBookNestで要約したもの）";
const TAGS = ["要点", "業界"];

/** 通信が一時的に失敗したときは、少し待ってやり直す */
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

  const book = await db.book.findFirst({ where: { title: { contains: "業界地図" } }, select: { id: true, title: true } });
  if (!book) throw new Error("業界地図の本が見つかりません");
  const notes = await db.knowledgeNote.findMany({ where: { books: { some: { bookId: book.id } } }, select: { id: true, title: true, content: true } });
  const noteByNo = new Map(notes.map((n) => [Number(n.content.match(/No\.(\d+)/)?.[1]), n]));
  const cks = await db.creativeKnowledge.findMany({ where: { slug: { not: null } }, select: { id: true, slug: true, title: true } });
  const ckBySlug = new Map(cks.map((k) => [k.slug!, k]));

  // 事前チェック：業界・創作知識がすべてそろっているか
  const missingNotes = INDUSTRY_POINTS.filter((p) => !noteByNo.has(p.no)).map((p) => p.no);
  const missingCk = [...new Set(INDUSTRY_POINTS.flatMap((p) => p.ck.map(([s]) => s)))].filter((s) => !ckBySlug.has(s));
  if (missingNotes.length || missingCk.length) throw new Error(`見つからない業界 No.${missingNotes.join(",")} / 創作知識 ${missingCk.join(",")}`);

  const existingTexts = new Set((await db.quote.findMany({ where: { bookId: book.id }, select: { text: true } })).map((q) => q.text));
  const existingRefs = new Set(
    (await db.creativeKnowledgeReference.findMany({ where: { knowledgeNoteId: { in: notes.map((n) => n.id) } }, select: { knowledgeId: true, knowledgeNoteId: true } })).map((r) => `${r.knowledgeId}|${r.knowledgeNoteId}`),
  );
  const newQuotes = INDUSTRY_POINTS.flatMap((p) => p.p.filter((t) => !existingTexts.has(t)).map((text) => ({ text, note: noteByNo.get(p.no)! })));
  const newRefs = INDUSTRY_POINTS.flatMap((p) =>
    p.ck.map(([slug, comment]) => ({ ck: ckBySlug.get(slug)!, note: noteByNo.get(p.no)!, comment })).filter((r) => !existingRefs.has(`${r.ck.id}|${r.note.id}`)),
  );
  const perCk = new Map<string, number>();
  for (const r of newRefs) perCk.set(r.ck.title, (perCk.get(r.ck.title) ?? 0) + 1);
  console.log(`業界 ${INDUSTRY_POINTS.length} 件 → 要点フレーズ ${newQuotes.length} 件・創作知識への参考 ${newRefs.length} 件を追加`);
  console.log("創作知識ごとの参考の数：" + [...perCk.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join("、"));
  for (const q of newQuotes.slice(0, 3)) console.log(`  例）[${q.note.title}] ${q.text}`);

  if (apply && (newQuotes.length || newRefs.length)) {
    const dir = path.join(process.cwd(), "data", "backups");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `before-industry-points-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify(await exportJson(db, { includeAi: true })));
    console.log(`✓ バックアップを保存しました：${path.relative(process.cwd(), file)}`);
    let i = 0;
    for (const q of newQuotes) {
      const created = await retry(async () => {
        // 前回の失敗で作成済みなら、それを使う
        const found = await db.quote.findFirst({ where: { bookId: book.id, text: q.text } });
        return found ?? (await createQuote(db, { text: q.text, bookId: book.id, note: NOTE, tags: TAGS }));
      }, "フレーズの追加");
      await retry(() => db.quoteKnowledge.upsert({ where: { quoteId_knowledgeId: { quoteId: created.id, knowledgeId: q.note.id } }, create: { quoteId: created.id, knowledgeId: q.note.id }, update: {} }), "知識へのつなぎ");
      if (++i % 50 === 0) console.log(`  フレーズ ${i}/${newQuotes.length}`);
    }
    for (const r of newRefs) await retry(() => addCkReference(db, { knowledgeId: r.ck.id, source: { kind: "knowledgeNote", id: r.note.id }, comment: r.comment }), "参考の追加");
    console.log(`✓ 要点フレーズ ${newQuotes.length} 件・創作知識への参考 ${newRefs.length} 件を追加しました`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error("✗ 失敗しました:", e instanceof Error ? e.message || e.stack || e.name : e);
  process.exit(1);
});
