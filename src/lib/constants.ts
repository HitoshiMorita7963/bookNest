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
  OWNED: "所有",
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

export const DEFAULT_GENRES = [
  "小説",
  "日本文学",
  "海外文学",
  "歴史",
  "政治",
  "経済",
  "ビジネス",
  "哲学",
  "心理学",
  "科学",
  "技術",
  "社会",
  "芸術",
  "エッセイ",
  "漫画",
  "人文学",
  "その他",
];

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
