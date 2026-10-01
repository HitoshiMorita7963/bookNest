import { z } from "zod";
import { BOOK_STATUSES, GOAL_TYPES, RECORD_STATUSES } from "./constants";

const optText = (max: number) =>
  z
    .string()
    .max(max, `${max}文字以内で入力してください`)
    .optional()
    .nullable()
    .transform((v) => (v == null ? null : v.trim() === "" ? null : v.trim()));

const optInt = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (v === undefined || v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).normalize("NFKC"));
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${min}〜${max}の整数で入力してください` });
        return z.NEVER;
      }
      return n;
    });

const optDate = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (v === undefined || v === null || v === "") return null;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "日付の形式が正しくありません" });
      return z.NEVER;
    }
    return d;
  });

const imageRef = z
  .string()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v.trim() || null : null))
  .refine((v) => v === null || /^https:\/\//.test(v) || /^http:\/\//.test(v) || /^\/api\/files\/[\w.-]+$/.test(v), {
    message: "画像URLの形式が正しくありません",
  });

const nameList = z
  .array(z.string().trim().min(1).max(100))
  .max(30)
  .default([])
  .transform((arr) => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean))));

export const bookStatusSchema = z.enum(BOOK_STATUSES);

export const bookInputSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(300),
  titleKana: optText(300),
  subtitle: optText(300),
  description: optText(5000),
  isbn: optText(20),
  publisher: optText(200),
  publishedAt: optText(20),
  pageCount: optInt(1, 100000),
  coverImage: imageRef,
  language: optText(10),
  genre: optText(50),
  status: bookStatusSchema.default("WANT_TO_READ"),
  authors: nameList,
  tags: nameList,
  seriesTitle: optText(200),
  seriesNumber: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }),
  acquiredAt: optDate,
});
export type BookInput = z.input<typeof bookInputSchema>;
export type BookData = z.output<typeof bookInputSchema>;

export const recordInputSchema = z.object({
  status: z.enum(RECORD_STATUSES).default("COMPLETED"),
  startedAt: optDate,
  finishedAt: optDate,
  rating: optInt(1, 5),
  review: optText(20000),
  summary: optText(20000),
  learned: optText(20000),
  memorable: optText(20000),
  questions: optText(20000),
});
export type RecordInput = z.input<typeof recordInputSchema>;

export const progressInputSchema = z.object({
  currentPage: optInt(0, 100000),
  minutes: optInt(0, 1440),
  note: optText(20000),
  date: optDate,
});
export type ProgressInput = z.input<typeof progressInputSchema>;

export const shelfInputSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(60),
  description: optText(500),
});

export const goalInputSchema = z.object({
  type: z.enum(GOAL_TYPES),
  year: z.coerce.number().int().min(1900).max(3000),
  month: optInt(1, 12),
  genre: optText(50),
  target: z.coerce.number().int().min(1, "1以上を入力してください").max(1000000),
});

export const quoteInputSchema = z.object({
  text: z.string().trim().min(1, "フレーズを入力してください").max(10000),
  bookId: optText(50),
  pageNumber: optText(40),
  note: optText(10000),
  originalImage: imageRef,
  tags: nameList,
  isFavorite: z.boolean().optional().default(false),
});
export type QuoteInput = z.input<typeof quoteInputSchema>;

export const knowledgeInputSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(200),
  content: z.string().max(50000).default(""),
  category: optText(60),
  tags: nameList,
  bookIds: z.array(z.string().max(50)).max(100).default([]),
  quoteIds: z.array(z.string().max(50)).max(200).default([]),
});
export type KnowledgeInput = z.input<typeof knowledgeInputSchema>;

export const pathInputSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(100),
  description: optText(2000),
  bookIds: z.array(z.string().max(50)).max(200).default([]),
});

export const authorInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  nameKana: optText(100),
  profile: optText(5000),
});

export const seriesInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: optText(2000),
  totalVolumes: optInt(1, 10000),
});

export function firstError(err: z.ZodError): string {
  const issue = err.issues[0];
  return issue?.message ?? "入力内容を確認してください";
}

/* ---------------- 創作 ---------------- */
import { CREATIVE_CATEGORIES, LINK_SOURCE_KINDS, LINK_TARGET_KINDS, NOTE_STATUSES, PROJECT_STATUSES, SCENE_STATUSES } from "./constants";

const reqText = (label: string, max: number) => z.string().trim().min(1, `${label}を入力してください`).max(max, `${max}文字以内で入力してください`);
const longText = (max: number) => optText(max);

export const creativeNoteInputSchema = z
  .object({
    title: z.string().trim().max(120, "120文字以内で入力してください").default(""),
    content: z.string().max(20000, "20000文字以内で入力してください").default(""),
    category: z.enum(CREATIVE_CATEGORIES).default("OTHER"),
    status: z.enum(NOTE_STATUSES).default("IDEA"),
    tags: nameList,
  })
  .refine((v) => v.title.trim() || v.content.trim(), { message: "タイトルか本文を入力してください", path: ["title"] })
  .transform((v) => ({
    ...v,
    // タイトル未入力なら本文の書き出しをタイトルにする（素早く保存するため）
    title: v.title.trim() || v.content.trim().split("\n")[0].slice(0, 40),
  }));
export type CreativeNoteInput = z.input<typeof creativeNoteInputSchema>;

export const projectInputSchema = z.object({
  title: reqText("作品タイトル", 120),
  logline: longText(300),
  synopsis: longText(20000),
  theme: longText(300),
  genre: longText(60),
  status: z.enum(PROJECT_STATUSES).default("IDEA"),
});
export type ProjectInput = z.input<typeof projectInputSchema>;

export const characterInputSchema = z.object({
  name: reqText("名前", 80),
  role: longText(40),
  age: longText(40),
  appearance: longText(5000),
  personality: longText(5000),
  background: longText(10000),
  goal: longText(5000),
  conflict: longText(5000),
  speechStyle: longText(5000),
  notes: longText(10000),
});
export type CharacterInput = z.input<typeof characterInputSchema>;

export const relationshipInputSchema = z.object({
  fromId: z.string().min(1).max(50),
  toId: z.string().min(1).max(50),
  label: reqText("関係", 40),
  notes: longText(2000),
});

export const worldInputSchema = z.object({
  title: reqText("項目名", 120),
  category: z.string().trim().max(20).default("その他"),
  content: z.string().max(20000).default(""),
});
export type WorldInput = z.input<typeof worldInputSchema>;

export const plotInputSchema = z.object({
  title: reqText("タイトル", 120),
  summary: longText(10000),
  status: z.enum(SCENE_STATUSES).default("IDEA"),
  notes: longText(10000),
});
export type PlotInput = z.input<typeof plotInputSchema>;

export const chapterInputSchema = z.object({
  title: reqText("章タイトル", 120),
  summary: longText(10000),
});
export type ChapterInput = z.input<typeof chapterInputSchema>;

export const sceneInputSchema = z.object({
  title: reqText("シーン名", 120),
  summary: longText(10000),
  content: longText(200000),
  status: z.enum(SCENE_STATUSES).default("IDEA"),
});
export type SceneInput = z.input<typeof sceneInputSchema>;

export const linkInputSchema = z.object({
  source: z.object({ kind: z.enum(LINK_SOURCE_KINDS), id: z.string().min(1).max(50) }),
  target: z.object({ kind: z.enum(LINK_TARGET_KINDS), id: z.string().min(1).max(50) }),
  purpose: longText(60),
});
export type LinkInput = z.input<typeof linkInputSchema>;
