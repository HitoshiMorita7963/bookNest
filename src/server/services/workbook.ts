/**
 * 全データを表計算ソフト向けの表（シート）にまとめる。Excel（.xlsx）として書き出し、
 * Excel・Google スプレッドシート・Numbers で開ける。ID の代わりに本のタイトルや作品名を入れて、人が読める形にする。
 * （アプリへ戻せる完全なバックアップは JSON 形式。src/server/services/backup.ts）
 */
import ExcelJS from "exceljs";
import type { Db } from "@/lib/db";
import { ckCategoryLabel } from "@/lib/creative-knowledge";
import {
  CREATIVE_CATEGORY_LABEL,
  GOAL_LABEL,
  LINK_SOURCE_LABEL,
  LINK_TARGET_LABEL,
  NOTE_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  SCENE_STATUS_LABEL,
  STATUS_LABEL,
  type CreativeCategory,
  type GoalType,
  type LinkSourceKind,
  type LinkTargetKind,
  type NoteStatus,
  type ProjectStatus,
  type SceneStatus,
} from "@/lib/constants";

type Cell = string | number | null | undefined;
export interface Sheet {
  name: string;
  headers: string[];
  rows: Cell[][];
  /** 列幅（文字数の目安） */
  widths?: number[];
}

/** 日本時間の「2026-10-01 12:34」（日付だけのものは「2026-10-01」） */
function jst(d: Date | null | undefined, withTime = true): string | null {
  if (!d) return null;
  const s = new Date(d.getTime() + 9 * 3600_000).toISOString();
  return withTime ? s.slice(0, 16).replace("T", " ") : s.slice(0, 10);
}
const join = (xs: (string | null | undefined)[]) => xs.filter(Boolean).join("、");
const label = <K extends string>(map: Record<K, string>, v: string | null | undefined) => (v ? (map[v as K] ?? v) : null);

export async function buildSheets(db: Db): Promise<Sheet[]> {
  const [books, records, sessions, quotes, knowledge, kLinks, notes, projects, links, authors, series, shelves, goals, paths, relations] = await Promise.all([
    db.book.findMany({
      include: {
        authors: { include: { author: { select: { name: true } } }, orderBy: { position: "asc" } },
        tags: { include: { tag: { select: { name: true } } } },
        series: { select: { title: true } },
        shelves: { include: { shelf: { select: { name: true } } } },
        _count: { select: { quotes: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.readingRecord.findMany({ include: { book: { select: { title: true } } }, orderBy: [{ createdAt: "asc" }] }),
    db.readingSession.findMany({ include: { book: { select: { title: true } } }, orderBy: { date: "asc" } }),
    db.quote.findMany({
      include: {
        book: { select: { title: true, authors: { include: { author: { select: { name: true } } }, orderBy: { position: "asc" } } } },
        tags: { include: { tag: { select: { name: true } } } },
        knowledge: { include: { knowledge: { select: { title: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.knowledgeNote.findMany({
      include: {
        tags: { include: { tag: { select: { name: true } } } },
        books: { include: { book: { select: { title: true } } } },
        _count: { select: { quotes: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.knowledgeLink.findMany({ include: { from: { select: { title: true } }, to: { select: { title: true } } }, orderBy: { createdAt: "asc" } }),
    db.creativeNote.findMany({ include: { tags: { include: { tag: { select: { name: true } } } } }, orderBy: { createdAt: "asc" } }),
    db.novelProject.findMany({
      include: {
        characters: { orderBy: { position: "asc" } },
        relationships: { include: { from: { select: { name: true } }, to: { select: { name: true } } } },
        worldSettings: { orderBy: { createdAt: "asc" } },
        plots: { orderBy: { position: "asc" } },
        chapters: { include: { scenes: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.creativeLink.findMany({
      include: {
        book: { select: { title: true } },
        quote: { select: { text: true } },
        knowledge: { select: { title: true } },
        note: { select: { title: true } },
        project: { select: { title: true } },
        character: { select: { name: true } },
        world: { select: { title: true } },
        plot: { select: { title: true } },
        chapter: { select: { title: true } },
        scene: { select: { title: true } },
        targetNote: { select: { title: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.author.findMany({ include: { _count: { select: { books: true } } }, orderBy: { name: "asc" } }),
    db.series.findMany({ include: { books: { select: { title: true, seriesNumber: true }, orderBy: { seriesNumber: "asc" } } }, orderBy: { title: "asc" } }),
    db.customShelf.findMany({ include: { books: { include: { book: { select: { title: true } } }, orderBy: { position: "asc" } } }, orderBy: { position: "asc" } }),
    db.readingGoal.findMany({ orderBy: [{ year: "asc" }, { month: "asc" }] }),
    db.readingPath.findMany({ include: { books: { include: { book: { select: { title: true } } }, orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } }),
    db.bookRelation.findMany({ include: { from: { select: { title: true } }, to: { select: { title: true } } } }),
  ]);

  const cks = await db.creativeKnowledge.findMany({
    include: { categories: { select: { category: true } }, tags: { include: { tag: { select: { name: true } } } } },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
  const ckTitle = new Map(cks.map((k) => [k.id, k.title]));

  const sheets: Sheet[] = [
    {
      name: "本",
      headers: ["タイトル", "よみ", "サブタイトル", "著者", "出版社", "発売日", "ページ数", "ISBN13", "ISBN10", "ジャンル", "タグ", "シリーズ", "巻", "ステータス", "現在のページ", "評価", "入手日", "読書開始日", "読了日", "マイ本棚", "フレーズ数", "内容紹介", "表紙画像", "登録日", "更新日", "ID"],
      widths: [30, 20, 20, 20, 16, 12, 8, 15, 12, 12, 20, 18, 6, 10, 8, 6, 12, 12, 12, 16, 8, 40, 30, 16, 16, 26],
      rows: books.map((b) => [
        b.title,
        b.titleKana,
        b.subtitle,
        join(b.authors.map((a) => a.author.name)),
        b.publisher,
        b.publishedAt,
        b.pageCount,
        b.isbn13,
        b.isbn10,
        b.genre,
        join(b.tags.map((t) => t.tag.name)),
        b.series?.title,
        b.seriesNumber,
        label(STATUS_LABEL, b.status),
        b.currentPage || null,
        b.rating,
        jst(b.acquiredAt, false),
        jst(b.startedAt, false),
        jst(b.finishedAt, false),
        join(b.shelves.map((s) => s.shelf.name)),
        b._count.quotes || null,
        b.description,
        b.coverImage?.startsWith("http") ? b.coverImage : null,
        jst(b.createdAt),
        jst(b.updatedAt),
        b.id,
      ]),
    },
    {
      name: "読書記録",
      headers: ["本", "状態", "読書開始日", "読了日", "評価", "感想", "要約", "学んだこと", "印象に残ったこと", "疑問点", "登録日", "ID"],
      widths: [30, 10, 12, 12, 6, 40, 30, 30, 30, 30, 16, 26],
      rows: records.map((r) => [r.book.title, label(STATUS_LABEL, r.status), jst(r.startedAt, false), jst(r.finishedAt, false), r.rating, r.review, r.summary, r.learned, r.memorable, r.questions, jst(r.createdAt), r.id]),
    },
    {
      name: "読書メモ・進捗",
      headers: ["日時", "本", "開始ページ", "終了ページ", "読んだページ", "読書時間（分）", "メモ"],
      widths: [16, 30, 10, 10, 10, 12, 40],
      rows: sessions.map((s) => [jst(s.date), s.book.title, s.startPage, s.endPage, s.pagesRead || null, s.minutes, s.note]),
    },
    {
      name: "フレーズ",
      headers: ["フレーズ", "本", "著者", "ページ", "自分のメモ", "タグ", "お気に入り", "関連する知識", "登録日", "更新日", "ID"],
      widths: [50, 24, 16, 8, 30, 16, 8, 24, 16, 16, 26],
      rows: quotes.map((q) => [
        q.text,
        q.book?.title,
        join(q.book?.authors.map((a) => a.author.name) ?? []),
        q.pageNumber,
        q.note,
        join(q.tags.map((t) => t.tag.name)),
        q.isFavorite ? "★" : null,
        join(q.knowledge.map((k) => k.knowledge.title)),
        jst(q.createdAt),
        jst(q.updatedAt),
        q.id,
      ]),
    },
    {
      name: "知識",
      headers: ["タイトル", "内容", "カテゴリ", "タグ", "関連書籍", "元になったフレーズ数", "登録日", "更新日", "ID"],
      widths: [24, 50, 12, 16, 24, 10, 16, 16, 26],
      rows: knowledge.map((k) => [
        k.title,
        k.content,
        k.category,
        join(k.tags.map((t) => t.tag.name)),
        join(k.books.map((b) => b.book.title)),
        k._count.quotes || null,
        jst(k.createdAt),
        jst(k.updatedAt),
        k.id,
      ]),
    },
    {
      name: "知識のつながり",
      headers: ["知識（から）", "知識（へ）", "つながりの説明", "登録日"],
      widths: [24, 24, 24, 16],
      rows: kLinks.map((l) => [l.from.title, l.to.title, l.label, jst(l.createdAt)]),
    },
    {
      name: "創作メモ",
      headers: ["タイトル", "内容", "種類", "状態", "タグ", "登録日", "更新日", "ID"],
      widths: [24, 50, 10, 10, 16, 16, 16, 26],
      rows: notes.map((n) => [
        n.title,
        n.content,
        label(CREATIVE_CATEGORY_LABEL as Record<CreativeCategory, string>, n.category),
        label(NOTE_STATUS_LABEL as Record<NoteStatus, string>, n.status),
        join(n.tags.map((t) => t.tag.name)),
        jst(n.createdAt),
        jst(n.updatedAt),
        n.id,
      ]),
    },
    {
      name: "創作知識",
      headers: ["タイトル", "カテゴリ", "ほかのカテゴリ", "サブカテゴリ", "概要", "定義・説明", "物語上の効果", "主なパターン", "感情・展開の流れ", "使い方", "注意点", "別名", "よみ", "作品例", "タグ", "自分のメモ", "お気に入り", "作成元", "登録日", "更新日", "ID"],
      widths: [22, 12, 16, 12, 40, 40, 30, 30, 24, 30, 30, 20, 16, 40, 16, 30, 8, 10, 16, 16, 26],
      rows: cks.map((k) => [
        k.title,
        ckCategoryLabel(k.category),
        join(k.categories.map((c) => ckCategoryLabel(c.category))),
        k.subCategory,
        k.summary || null,
        k.definition || null,
        k.effects || null,
        k.patterns || null,
        k.flow || null,
        k.usage || null,
        k.cautions || null,
        k.aliases || null,
        k.reading || null,
        k.examples || null,
        join(k.tags.map((t) => t.tag.name)),
        k.myNote || null,
        k.isFavorite ? "★" : null,
        k.origin === "seed" ? "サンプル" : "自分で作成",
        jst(k.createdAt),
        jst(k.updatedAt),
        k.id,
      ]),
    },
    {
      name: "作品",
      headers: ["タイトル", "状態", "ジャンル", "テーマ", "一行あらすじ", "作品概要", "人物数", "章数", "登録日", "更新日", "ID"],
      widths: [24, 10, 12, 16, 30, 40, 8, 8, 16, 16, 26],
      rows: projects.map((p) => [
        p.title,
        label(PROJECT_STATUS_LABEL as Record<ProjectStatus, string>, p.status),
        p.genre,
        p.theme,
        p.logline,
        p.synopsis,
        p.characters.length,
        p.chapters.length,
        jst(p.createdAt),
        jst(p.updatedAt),
        p.id,
      ]),
    },
    {
      name: "人物",
      headers: ["作品", "名前", "役割", "年齢", "外見", "性格", "背景", "目的", "葛藤", "口調", "メモ"],
      widths: [20, 14, 12, 8, 24, 24, 30, 24, 24, 20, 30],
      rows: projects.flatMap((p) => p.characters.map((c) => [p.title, c.name, c.role, c.age, c.appearance, c.personality, c.background, c.goal, c.conflict, c.speechStyle, c.notes])),
    },
    {
      name: "人物の関係",
      headers: ["作品", "人物（から）", "人物（へ）", "関係", "メモ"],
      widths: [20, 14, 14, 16, 30],
      rows: projects.flatMap((p) => p.relationships.map((r) => [p.title, r.from.name, r.to.name, r.label, r.notes])),
    },
    {
      name: "世界観",
      headers: ["作品", "タイトル", "分類", "内容"],
      widths: [20, 20, 10, 50],
      rows: projects.flatMap((p) => p.worldSettings.map((w) => [p.title, w.title, w.category, w.content])),
    },
    {
      name: "プロット",
      headers: ["作品", "順番", "タイトル", "状態", "概要", "メモ"],
      widths: [20, 6, 20, 10, 40, 30],
      rows: projects.flatMap((p) => p.plots.map((x, i) => [p.title, i + 1, x.title, label(SCENE_STATUS_LABEL as Record<SceneStatus, string>, x.status), x.summary, x.notes])),
    },
    {
      name: "章・シーン",
      headers: ["作品", "章の順番", "章", "章の概要", "シーンの順番", "シーン", "シーンの状態", "シーンの概要", "本文の下書き"],
      widths: [20, 8, 20, 30, 8, 20, 10, 30, 50],
      rows: projects.flatMap((p) =>
        p.chapters.flatMap((c, ci) =>
          c.scenes.length
            ? c.scenes.map((s, si) => [p.title, ci + 1, c.title, c.summary, si + 1, s.title, label(SCENE_STATUS_LABEL as Record<SceneStatus, string>, s.status), s.summary, s.content])
            : [[p.title, ci + 1, c.title, c.summary, null, null, null, null, null]],
        ),
      ),
    },
    {
      name: "読書と創作の紐付け",
      headers: ["元の種類", "元", "先の種類", "先", "作品", "用途", "登録日"],
      widths: [10, 30, 10, 24, 20, 16, 16],
      rows: links.map((l) => {
        const [srcKind, src]: [LinkSourceKind, string | undefined] = l.book
          ? ["book", l.book.title]
          : l.quote
            ? ["quote", l.quote.text]
            : l.knowledge
              ? ["knowledge", l.knowledge.title]
              : l.ckId
                ? ["ck", ckTitle.get(l.ckId)]
                : ["note", l.note?.title];
        const [dstKind, dst]: [LinkTargetKind, string | undefined] = l.scene
          ? ["scene", l.scene.title]
          : l.chapter
            ? ["chapter", l.chapter.title]
            : l.character
              ? ["character", l.character.name]
              : l.world
                ? ["world", l.world.title]
                : l.plot
                  ? ["plot", l.plot.title]
                  : l.targetNote
                    ? ["note", l.targetNote.title]
                    : ["project", l.project?.title];
        return [LINK_SOURCE_LABEL[srcKind], src, LINK_TARGET_LABEL[dstKind], dst, l.project?.title, l.purpose, jst(l.createdAt)];
      }),
    },
    {
      name: "著者",
      headers: ["名前", "よみ", "プロフィール", "登録冊数"],
      widths: [20, 20, 40, 8],
      rows: authors.map((a) => [a.name, a.nameKana, a.profile, a._count.books]),
    },
    {
      name: "シリーズ",
      headers: ["シリーズ", "全巻数", "登録冊数", "登録している巻", "説明"],
      widths: [24, 8, 8, 40, 30],
      rows: series.map((s) => [s.title, s.totalVolumes, s.books.length, join(s.books.map((b) => (b.seriesNumber != null ? `${b.seriesNumber}巻` : b.title))), s.description]),
    },
    {
      name: "マイ本棚",
      headers: ["本棚", "説明", "冊数", "本"],
      widths: [20, 30, 8, 60],
      rows: shelves.map((s) => [s.name, s.description, s.books.length, join(s.books.map((b) => b.book.title))]),
    },
    {
      name: "読書ルート",
      headers: ["ルート", "説明", "順番", "本", "メモ"],
      widths: [20, 30, 6, 30, 30],
      rows: paths.flatMap((p) => (p.books.length ? p.books.map((b, i) => [p.title, p.description, i + 1, b.book.title, b.note]) : [[p.title, p.description, null, null, null]])),
    },
    {
      name: "関連する本",
      headers: ["本（から）", "本（へ）", "メモ"],
      widths: [30, 30, 30],
      rows: relations.map((r) => [r.from.title, r.to.title, r.note]),
    },
    {
      name: "読書目標",
      headers: ["種類", "年", "月", "ジャンル", "目標"],
      widths: [16, 8, 6, 12, 8],
      rows: goals.map((g) => [label(GOAL_LABEL as Record<GoalType, string>, g.type), g.year, g.month, g.genre, g.target]),
    },
  ];
  return sheets;
}

/** シートの一覧を Excel ファイルにする */
export async function toXlsx(sheets: Sheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BookNest";
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = s.headers.map((h, i) => ({ header: h, width: Math.min(Math.max(s.widths?.[i] ?? 14, 6), 60) }));
    // セルの上限（32,767文字）を超えないようにする
    for (const r of s.rows) ws.addRow(r.map((v) => (typeof v === "string" && v.length > 32000 ? `${v.slice(0, 32000)}…` : (v ?? null))));
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF8" } };
    if (s.rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.headers.length } };
    // 長い文章の列は折り返して表示
    s.headers.forEach((_, i) => {
      if ((s.widths?.[i] ?? 0) >= 30) ws.getColumn(i + 1).alignment = { wrapText: true, vertical: "top" };
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
