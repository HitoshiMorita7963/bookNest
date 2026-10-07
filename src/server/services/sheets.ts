/**
 * Google スプレッドシートへの自動反映。
 * スプレッドシート側に置いた Apps Script（docs/sheets-sync/Code.gs）の Web アプリへ送信する。
 * SHEETS_WEBHOOK_URL / SHEETS_WEBHOOK_SECRET が未設定なら何もしない。
 */
import type { Db } from "@/lib/db";
import { CREATIVE_CATEGORY_LABEL, NOTE_STATUS_LABEL, type CreativeCategory, type NoteStatus } from "@/lib/constants";
import { attachCk, describeSource, describeTarget, linkSourceInclude, linkTargetInclude } from "./creative";

export type SheetKind = "quote" | "knowledge" | "note";

/** シート名と列（1列目は必ず ID。行の特定に使う） */
export const SHEETS: Record<SheetKind, { name: string; headers: string[] }> = {
  quote: { name: "フレーズ", headers: ["ID", "フレーズ", "本", "著者", "ページ", "メモ", "タグ", "お気に入り", "登録日", "更新日", "リンク"] },
  knowledge: { name: "知識", headers: ["ID", "タイトル", "内容", "カテゴリ", "タグ", "関連する本", "登録日", "更新日", "リンク"] },
  note: { name: "創作メモ", headers: ["ID", "タイトル", "内容", "種類", "状態", "タグ", "元になった資料", "使っている作品", "登録日", "更新日", "リンク"] },
};

export function sheetsConfigured() {
  return !!process.env.SHEETS_WEBHOOK_URL?.trim() && !!process.env.SHEETS_WEBHOOK_SECRET?.trim();
}

type Cell = string | number | boolean;

/** 日本時間の「2026-10-01 12:34」形式 */
function jst(d: Date): string {
  const t = new Date(d.getTime() + 9 * 3600_000);
  return t.toISOString().slice(0, 16).replace("T", " ");
}

function link(path: string): string {
  const base = process.env.APP_URL?.trim().replace(/\/$/, "");
  return base ? `${base}${path}` : path;
}

/** 先頭が = + - @ の値は数式として解釈されないようにする */
function safe(s: string | null | undefined): string {
  const v = s ?? "";
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

const tagNames = (tags: { tag: { name: string } }[]) => tags.map((t) => t.tag.name).join(", ");

export async function quoteRows(db: Db, ids?: string[]): Promise<Cell[][]> {
  const rows = await db.quote.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: {
      book: { select: { title: true, authors: { include: { author: { select: { name: true } } }, orderBy: { position: "asc" } } } },
      tags: { include: { tag: { select: { name: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((q) => [
    q.id,
    safe(q.text),
    safe(q.book?.title),
    safe(q.book?.authors.map((a) => a.author.name).join(", ")),
    safe(q.pageNumber),
    safe(q.note),
    safe(tagNames(q.tags)),
    q.isFavorite ? "★" : "",
    jst(q.createdAt),
    jst(q.updatedAt),
    link(`/quotes/${q.id}`),
  ]);
}

export async function knowledgeRows(db: Db, ids?: string[]): Promise<Cell[][]> {
  const rows = await db.knowledgeNote.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: { tags: { include: { tag: { select: { name: true } } } }, books: { include: { book: { select: { title: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((k) => [
    k.id,
    safe(k.title),
    safe(k.content),
    safe(k.category),
    safe(tagNames(k.tags)),
    safe(k.books.map((b) => `『${b.book.title}』`).join(", ")),
    jst(k.createdAt),
    jst(k.updatedAt),
    link(`/knowledge/${k.id}`),
  ]);
}

export async function noteRows(db: Db, ids?: string[]): Promise<Cell[][]> {
  const rows = await db.creativeNote.findMany({
    where: ids ? { id: { in: ids } } : {},
    include: {
      tags: { include: { tag: { select: { name: true } } } },
      materials: { include: linkSourceInclude },
      usedIn: { include: linkTargetInclude },
    },
    orderBy: { createdAt: "asc" },
  });
  // 創作知識の元の名前を付ける（attachCk は各行にそのまま ck を書き足す）
  await attachCk(db, rows.flatMap((n) => n.materials));
  return rows.map((n) => {
    const used = n.usedIn.map((l) => {
      const t = describeTarget(l);
      return t.projectTitle && t.kind !== "project" ? `${t.projectTitle}：${t.label}` : t.label;
    });
    return [
      n.id,
      safe(n.title),
      safe(n.content),
      CREATIVE_CATEGORY_LABEL[n.category as CreativeCategory] ?? n.category,
      NOTE_STATUS_LABEL[n.status as NoteStatus] ?? n.status,
      safe(tagNames(n.tags)),
      safe(n.materials.map((l) => describeSource(l).label).join(" / ")),
      safe(Array.from(new Set(used)).join(" / ")),
      jst(n.createdAt),
      jst(n.updatedAt),
      link(`/creative/notes/${n.id}`),
    ];
  });
}

const ROW_BUILDERS: Record<SheetKind, (db: Db, ids?: string[]) => Promise<Cell[][]>> = { quote: quoteRows, knowledge: knowledgeRows, note: noteRows };

export type SheetsPayload =
  | { action: "upsert"; sheet: string; headers: string[]; rows: Cell[][] }
  | { action: "delete"; sheet: string; headers: string[]; ids: string[] }
  | { action: "replace"; sheet: string; headers: string[]; rows: Cell[][] }
  | { action: "ping" };

export type SheetsSender = (payload: SheetsPayload) => Promise<void>;

/** Apps Script の Web アプリへ送る（リダイレクト先の応答まで確認する） */
export const postToSheets: SheetsSender = async (payload) => {
  const url = process.env.SHEETS_WEBHOOK_URL?.trim();
  const secret = process.env.SHEETS_WEBHOOK_SECRET?.trim();
  if (!url || !secret) return;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      // Apps Script は text/plain のほうが余計な事前確認なしで受け取れる
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, secret }),
      redirect: "follow",
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json: { ok?: boolean; error?: string } = {};
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`スプレッドシートから想定外の応答がありました（HTTP ${res.status}）。WebアプリのURLとアクセス権（全員）を確認してください。`);
    }
    if (!json.ok) throw new Error(json.error === "unauthorized" ? "合言葉（SHEETS_WEBHOOK_SECRET）がスプレッドシート側と一致しません。" : `スプレッドシート側でエラー: ${json.error ?? "不明"}`);
  } finally {
    clearTimeout(timer);
  }
};

/** 指定したデータの行を追加・更新する（DB から消えていれば行を削除する） */
export async function syncItems(db: Db, kind: SheetKind, ids: string[], send: SheetsSender = postToSheets) {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return;
  const { name, headers } = SHEETS[kind];
  const rows = await ROW_BUILDERS[kind](db, uniq);
  const present = new Set(rows.map((r) => r[0] as string));
  const gone = uniq.filter((id) => !present.has(id));
  if (rows.length) await send({ action: "upsert", sheet: name, headers, rows });
  if (gone.length) await send({ action: "delete", sheet: name, headers, ids: gone });
}

export async function deleteItems(kind: SheetKind, ids: string[], send: SheetsSender = postToSheets) {
  if (!ids.length) return;
  const { name, headers } = SHEETS[kind];
  await send({ action: "delete", sheet: name, headers, ids });
}

/** 3つのシートを丸ごと書き直す（初回や、まとめて変更した後に使う） */
export async function syncAll(db: Db, send: SheetsSender = postToSheets) {
  const counts: Record<SheetKind, number> = { quote: 0, knowledge: 0, note: 0 };
  for (const kind of Object.keys(SHEETS) as SheetKind[]) {
    const { name, headers } = SHEETS[kind];
    const rows = await ROW_BUILDERS[kind](db);
    await send({ action: "replace", sheet: name, headers, rows });
    counts[kind] = rows.length;
  }
  return counts;
}
