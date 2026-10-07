import { GENRES } from "./classify";
export const BOOK_STATUSES = [
  "WANT_TO_READ",
  "OWNED",
  "READING",
  "COMPLETED",
  "PAUSED",
  "DROPPED",
] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export const STATUS_LABEL: Record<BookStatus, string> = {
  WANT_TO_READ: "読みたい",
  OWNED: "積読",
  READING: "読書中",
  COMPLETED: "読了",
  PAUSED: "中断",
  DROPPED: "読了断念",
};

export const STATUS_EMOJI: Record<BookStatus, string> = {
  WANT_TO_READ: "🔖",
  OWNED: "📕",
  READING: "📖",
  COMPLETED: "✅",
  PAUSED: "⏸",
  DROPPED: "🚫",
};

export const STATUS_COLOR: Record<BookStatus, string> = {
  WANT_TO_READ: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  OWNED: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  READING: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  COMPLETED: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  PAUSED: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
  DROPPED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

export const RECORD_STATUSES = ["READING", "COMPLETED", "PAUSED", "DROPPED"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

export const GOAL_TYPES = ["YEARLY_BOOKS", "YEARLY_PAGES", "MONTHLY_BOOKS", "GENRE_BOOKS"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
export const GOAL_LABEL: Record<GoalType, string> = {
  YEARLY_BOOKS: "年間冊数",
  YEARLY_PAGES: "年間ページ数",
  MONTHLY_BOOKS: "月間冊数",
  GENRE_BOOKS: "ジャンル別冊数",
};

/** ジャンルの候補（自動提案と同じ一覧。src/lib/classify.ts） */
export const DEFAULT_GENRES: readonly string[] = GENRES;

export const SORT_OPTIONS = {
  createdAt: "追加日",
  title: "タイトル",
  rating: "評価",
  finishedAt: "読了日",
  pageCount: "ページ数",
  publishedAt: "発売日",
} as const;
export type SortKey = keyof typeof SORT_OPTIONS;

export const PAGE_SIZE = 48;

export const MAX_UPLOAD_BYTES = (Number(process.env.MAX_UPLOAD_MB) || 10) * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

/* ---------------- 創作 ---------------- */
export const CREATIVE_CATEGORIES = ["CHARACTER", "SETTING", "PLOT", "SCENE", "DIALOGUE", "DESCRIPTION", "THEME", "MOTIF", "TITLE", "OTHER"] as const;
export type CreativeCategory = (typeof CREATIVE_CATEGORIES)[number];
export const CREATIVE_CATEGORY_LABEL: Record<CreativeCategory, string> = {
  CHARACTER: "人物",
  SETTING: "設定",
  PLOT: "ストーリー",
  SCENE: "シーン",
  DIALOGUE: "セリフ",
  DESCRIPTION: "描写",
  THEME: "テーマ",
  MOTIF: "モチーフ",
  TITLE: "タイトル案",
  OTHER: "その他",
};
export const CREATIVE_CATEGORY_EMOJI: Record<CreativeCategory, string> = {
  CHARACTER: "👤",
  SETTING: "🌍",
  PLOT: "📋",
  SCENE: "🎬",
  DIALOGUE: "💬",
  DESCRIPTION: "🖋",
  THEME: "🎯",
  MOTIF: "🔁",
  TITLE: "🏷",
  OTHER: "💡",
};

export const NOTE_STATUSES = ["IDEA", "IN_USE", "USED", "ARCHIVED"] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];
export const NOTE_STATUS_LABEL: Record<NoteStatus, string> = { IDEA: "アイデア", IN_USE: "使用中", USED: "使用済み", ARCHIVED: "アーカイブ" };

export const PROJECT_STATUSES = ["IDEA", "PLANNING", "WRITING", "COMPLETED", "ON_HOLD"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = { IDEA: "アイデア", PLANNING: "企画中", WRITING: "執筆中", COMPLETED: "完結", ON_HOLD: "保留" };

/** プロット・シーン共通の進行状態 */
export const SCENE_STATUSES = ["IDEA", "OUTLINE", "DRAFT", "REVISED", "COMPLETED"] as const;
export type SceneStatus = (typeof SCENE_STATUSES)[number];
export const SCENE_STATUS_LABEL: Record<SceneStatus, string> = { IDEA: "アイデア", OUTLINE: "構想", DRAFT: "初稿", REVISED: "改稿", COMPLETED: "完成" };

export const WORLD_CATEGORIES = ["世界", "歴史", "地理", "文化", "社会", "宗教", "技術", "魔法", "政治", "経済", "その他"] as const;

export const CHARACTER_ROLE_SUGGESTIONS = ["主人公", "ヒロイン", "ライバル", "親友", "敵役", "師匠", "家族", "脇役"];

/** 参考資料の用途の候補（自由入力も可） */
export const REFERENCE_PURPOSES = ["人物造形", "会話", "情景描写", "ストーリー構成", "世界観", "テーマ", "雰囲気", "考証・資料", "タイトル"];

/** 創作に紐付ける先の種類 */
export const LINK_TARGET_KINDS = ["project", "character", "world", "plot", "chapter", "scene", "note"] as const;
export type LinkTargetKind = (typeof LINK_TARGET_KINDS)[number];
export const LINK_TARGET_LABEL: Record<LinkTargetKind, string> = {
  project: "作品全体",
  character: "人物",
  world: "世界観",
  plot: "プロット",
  chapter: "章",
  scene: "シーン",
  note: "創作メモ",
};
export const LINK_SOURCE_KINDS = ["book", "quote", "knowledge", "ck", "note"] as const;
export type LinkSourceKind = (typeof LINK_SOURCE_KINDS)[number];
export const LINK_SOURCE_ICON: Record<LinkSourceKind, string> = { book: "📚", quote: "💬", knowledge: "🧠", ck: "🧭", note: "💡" };
export const LINK_SOURCE_LABEL: Record<LinkSourceKind, string> = { book: "本", quote: "フレーズ", knowledge: "知識", ck: "創作知識", note: "創作メモ" };
