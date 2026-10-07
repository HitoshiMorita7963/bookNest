/**
 * バックアップ（エクスポート／インポート）
 * JSON は全テーブルを含む。インポート時は既存データとの重複を検出し、
 * 重複分は既存データに対応付けて取り込む（上書きはしない）。
 */
import { format } from "date-fns";
import type { Db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cleanupOrphans } from "./books";

export const BACKUP_VERSION = 1;

const TABLES = [
  "author",
  "series",
  "tag",
  "book",
  "bookAuthor",
  "bookTag",
  "bookRelation",
  "readingRecord",
  "readingSession",
  "customShelf",
  "shelfBook",
  "readingGoal",
  "quote",
  "quoteTag",
  "knowledgeNote",
  "knowledgeTag",
  "bookKnowledge",
  "quoteKnowledge",
  "knowledgeLink",
  "readingPath",
  "readingPathBook",
  "creativeNote",
  "creativeNoteTag",
  "novelProject",
  "character",
  "characterRelationship",
  "worldSetting",
  "plot",
  "chapter",
  "scene",
  "creativeKnowledge",
  "creativeKnowledgeCategory",
  "creativeKnowledgeTag",
  "creativeKnowledgeRelation",
  "creativeKnowledgeReference",
  "creativeKnowledgeSource",
  "creativeLink",
  "aIConversation",
  "aIMessage",
] as const;
type Table = (typeof TABLES)[number];
type Row = Record<string, unknown>;

export interface BackupFile {
  app: "BookNest";
  version: number;
  exportedAt: string;
  tables: Partial<Record<Table, Row[]>>;
}

type Delegate = { findMany: (args?: unknown) => Promise<Row[]>; create: (args: { data: Row }) => Promise<Row> };
const delegate = (db: Db, t: Table) => (db as unknown as Record<Table, Delegate>)[t];

export async function exportJson(db: Db, opts: { includeAi?: boolean } = {}): Promise<BackupFile> {
  const tables: BackupFile["tables"] = {};
  for (const t of TABLES) {
    if (!opts.includeAi && (t === "aIConversation" || t === "aIMessage")) continue;
    tables[t] = await delegate(db, t).findMany();
  }
  return { app: "BookNest", version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

/* ---------------- CSV ---------------- */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? format(v, "yyyy-MM-dd") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(header: string[], rows: unknown[][]) {
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function exportCsv(db: Db, type: "books" | "records" | "quotes"): Promise<string> {
  if (type === "books") {
    const books = await db.book.findMany({
      include: { authors: { include: { author: true }, orderBy: { position: "asc" } }, tags: { include: { tag: true } }, series: true },
      orderBy: { createdAt: "asc" },
    });
    return toCsv(
      ["タイトル", "サブタイトル", "著者", "ISBN13", "出版社", "発売日", "ページ数", "ジャンル", "タグ", "ステータス", "評価", "現在ページ", "シリーズ", "巻", "入手日", "読書開始日", "読了日", "登録日"],
      books.map((b) => [
        b.title,
        b.subtitle,
        b.authors.map((a) => a.author.name).join(" / "),
        b.isbn13,
        b.publisher,
        b.publishedAt,
        b.pageCount,
        b.genre,
        b.tags.map((t) => t.tag.name).join(" / "),
        b.status,
        b.rating,
        b.currentPage,
        b.series?.title,
        b.seriesNumber,
        b.acquiredAt,
        b.startedAt,
        b.finishedAt,
        b.createdAt,
      ]),
    );
  }
  if (type === "records") {
    const records = await db.readingRecord.findMany({ include: { book: { select: { title: true, isbn13: true } } }, orderBy: { createdAt: "asc" } });
    return toCsv(
      ["タイトル", "ISBN13", "状態", "開始日", "読了日", "評価", "感想", "要約", "学んだこと", "印象に残ったこと", "疑問点"],
      records.map((r) => [r.book.title, r.book.isbn13, r.status, r.startedAt, r.finishedAt, r.rating, r.review, r.summary, r.learned, r.memorable, r.questions]),
    );
  }
  const quotes = await db.quote.findMany({
    include: { book: { select: { title: true, authors: { include: { author: true } } } }, tags: { include: { tag: true } } },
    orderBy: { createdAt: "asc" },
  });
  return toCsv(
    ["フレーズ", "本", "著者", "ページ", "タグ", "メモ", "お気に入り", "保存日"],
    quotes.map((q) => [q.text, q.book?.title, q.book?.authors.map((a) => a.author.name).join(" / "), q.pageNumber, q.tags.map((t) => t.tag.name).join(" / "), q.note, q.isFavorite ? "1" : "", q.createdAt]),
  );
}

/* ---------------- インポート ---------------- */
const DATE_KEYS = /(At|^date)$/;
function revive(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "string" && DATE_KEYS.test(k) && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : v;
  }
  return out;
}

export function parseBackup(text: string): BackupFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AppError("JSONファイルを読み込めませんでした。BookNest のバックアップファイルを選択してください。", "VALIDATION");
  }
  const f = json as BackupFile;
  if (!f || f.app !== "BookNest" || typeof f.version !== "number" || typeof f.tables !== "object") {
    throw new AppError("BookNest のバックアップファイルではありません。", "VALIDATION");
  }
  if (f.version > BACKUP_VERSION) throw new AppError("このバックアップは新しいバージョンのアプリで作成されています。", "VALIDATION");
  for (const [k, v] of Object.entries(f.tables)) {
    if (!TABLES.includes(k as Table) || !Array.isArray(v)) throw new AppError("バックアップファイルの形式が正しくありません。", "VALIDATION");
  }
  return f;
}

interface Plan {
  idMap: Record<string, Map<string, string>>;
  counts: Record<string, { total: number; duplicate: number }>;
}

/** 重複の検出：本は ID・ISBN、著者/タグ/シリーズ/本棚は名前、その他は ID で照合 */
async function plan(db: Db, f: BackupFile): Promise<Plan> {
  const idMap: Plan["idMap"] = {};
  const counts: Plan["counts"] = {};
  const t = f.tables;
  const map = (table: string) => (idMap[table] ??= new Map());

  const byName = async (table: "author" | "tag" | "series" | "customShelf", key: "name" | "title") => {
    const rows = t[table] ?? [];
    const existing = await delegate(db, table).findMany();
    const lookup = new Map(existing.map((e) => [String(e[key]), String(e.id)]));
    let dup = 0;
    for (const r of rows) {
      const hit = lookup.get(String(r[key]));
      if (hit) {
        map(table).set(String(r.id), hit);
        dup++;
      }
    }
    counts[table] = { total: rows.length, duplicate: dup };
  };
  await byName("author", "name");
  await byName("tag", "name");
  await byName("series", "title");
  await byName("customShelf", "name");

  const books = t.book ?? [];
  const existingBooks = await db.book.findMany({ select: { id: true, isbn13: true } });
  const ids = new Set(existingBooks.map((b) => b.id));
  const isbn = new Map(existingBooks.filter((b) => b.isbn13).map((b) => [b.isbn13!, b.id]));
  let dupBooks = 0;
  for (const b of books) {
    const hit = ids.has(String(b.id)) ? String(b.id) : b.isbn13 ? isbn.get(String(b.isbn13)) : undefined;
    if (hit) {
      map("book").set(String(b.id), hit);
      dupBooks++;
    }
  }
  counts.book = { total: books.length, duplicate: dupBooks };

  for (const table of ["readingRecord", "readingSession", "readingGoal", "quote", "knowledgeNote", "readingPath", "creativeNote", "novelProject", "character", "characterRelationship", "worldSetting", "plot", "chapter", "scene", "creativeKnowledge", "creativeKnowledgeRelation", "creativeKnowledgeReference", "creativeKnowledgeSource", "creativeLink", "aIConversation", "aIMessage"] as const) {
    const rows = t[table] ?? [];
    const existing = new Set((await delegate(db, table).findMany()).map((r) => String(r.id)));
    let dup = 0;
    for (const r of rows) {
      if (existing.has(String(r.id))) {
        map(table).set(String(r.id), String(r.id));
        dup++;
      }
    }
    counts[table] = { total: rows.length, duplicate: dup };
  }
  // サンプルの創作知識は ID が違っても slug が同じなら同じものとして扱う（slug は一意）
  const ckSlugs = new Map((await db.creativeKnowledge.findMany({ where: { slug: { not: null } }, select: { id: true, slug: true } })).map((k) => [k.slug!, k.id]));
  for (const r of t.creativeKnowledge ?? []) {
    const hit = r.slug ? ckSlugs.get(String(r.slug)) : undefined;
    if (hit && !map("creativeKnowledge").has(String(r.id))) {
      map("creativeKnowledge").set(String(r.id), hit);
      counts.creativeKnowledge.duplicate++;
    }
  }
  return { idMap, counts };
}

export async function previewImport(db: Db, text: string) {
  const f = parseBackup(text);
  const p = await plan(db, f);
  return { exportedAt: f.exportedAt, counts: p.counts };
}

const FK: Partial<Record<Table, Record<string, string>>> = {
  book: { seriesId: "series" },
  bookAuthor: { bookId: "book", authorId: "author" },
  bookTag: { bookId: "book", tagId: "tag" },
  bookRelation: { fromId: "book", toId: "book" },
  readingRecord: { bookId: "book" },
  readingSession: { bookId: "book", recordId: "readingRecord" },
  shelfBook: { shelfId: "customShelf", bookId: "book" },
  quote: { bookId: "book" },
  quoteTag: { quoteId: "quote", tagId: "tag" },
  knowledgeTag: { knowledgeId: "knowledgeNote", tagId: "tag" },
  bookKnowledge: { bookId: "book", knowledgeId: "knowledgeNote" },
  quoteKnowledge: { quoteId: "quote", knowledgeId: "knowledgeNote" },
  knowledgeLink: { fromId: "knowledgeNote", toId: "knowledgeNote" },
  readingPathBook: { pathId: "readingPath", bookId: "book" },
  aIMessage: { conversationId: "aIConversation" },
  aIConversation: { projectId: "novelProject" },
  creativeNoteTag: { noteId: "creativeNote", tagId: "tag" },
  character: { projectId: "novelProject" },
  characterRelationship: { projectId: "novelProject", fromId: "character", toId: "character" },
  worldSetting: { projectId: "novelProject" },
  plot: { projectId: "novelProject" },
  chapter: { projectId: "novelProject" },
  scene: { chapterId: "chapter" },
  creativeKnowledgeCategory: { knowledgeId: "creativeKnowledge" },
  creativeKnowledgeTag: { knowledgeId: "creativeKnowledge", tagId: "tag" },
  creativeKnowledgeRelation: { fromId: "creativeKnowledge", toId: "creativeKnowledge" },
  creativeKnowledgeReference: {
    knowledgeId: "creativeKnowledge",
    bookId: "book",
    quoteId: "quote",
    sessionId: "readingSession",
    recordId: "readingRecord",
    knowledgeNoteId: "knowledgeNote",
  },
  creativeKnowledgeSource: { knowledgeId: "creativeKnowledge", bookId: "book" },
  creativeLink: {
    ckId: "creativeKnowledge",
    bookId: "book",
    quoteId: "quote",
    knowledgeId: "knowledgeNote",
    noteId: "creativeNote",
    projectId: "novelProject",
    characterId: "character",
    worldId: "worldSetting",
    plotId: "plot",
    chapterId: "chapter",
    sceneId: "scene",
    targetNoteId: "creativeNote",
  },
};
const JOIN_TABLES = new Set<Table>(["creativeKnowledgeCategory", "creativeKnowledgeTag", "creativeNoteTag", "bookAuthor", "bookTag", "bookRelation", "shelfBook", "quoteTag", "knowledgeTag", "bookKnowledge", "quoteKnowledge", "knowledgeLink", "readingPathBook"]);

export async function runImport(db: Db, text: string) {
  const f = parseBackup(text);
  const p = await plan(db, f);
  const created: Record<string, number> = {};
  await db.$transaction(
    async (tx) => {
      for (const table of TABLES) {
        const rows = f.tables[table] ?? [];
        const m = p.idMap[table] ?? new Map<string, string>();
        let n = 0;
        for (const raw of rows) {
          const row = revive(raw);
          if (!JOIN_TABLES.has(table) && m.has(String(row.id))) continue; // 重複は既存に対応付け済み
          let skip = false;
          for (const [col, ref] of Object.entries(FK[table] ?? {})) {
            const v = row[col];
            if (v === null || v === undefined) continue;
            const mapped = p.idMap[ref]?.get(String(v));
            if (mapped) row[col] = mapped;
            else if (!(f.tables[ref as Table] ?? []).some((r) => String(r.id) === String(v))) {
              if (
                col === "seriesId" ||
                (col === "recordId" && table !== "creativeKnowledgeReference") ||
                (table === "quote" && col === "bookId") ||
                (table === "creativeKnowledgeSource" && col === "bookId") ||
                table === "aIConversation"
              )
                row[col] = null;
              else skip = true;
            }
          }
          if (skip) continue;
          try {
            await (tx as unknown as Record<Table, Delegate>)[table].create({ data: row });
            n++;
          } catch (e) {
            // 中間テーブルの重複などは無視して続行
            if ((e as { code?: string }).code !== "P2002") throw e;
          }
        }
        if (n) created[table] = n;
      }
      await cleanupOrphans(tx);
    },
    { timeout: 120_000 },
  );
  return created;
}

export async function deleteAllData(db: Db) {
  await db.$transaction(async (tx) => {
    for (const table of [...TABLES].reverse()) await (tx as unknown as Record<Table, { deleteMany: () => Promise<unknown> }>)[table].deleteMany();
  });
}
