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
