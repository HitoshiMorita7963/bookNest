import "server-only";
/**
 * AI 司書が使うツール。すべてアプリ内データ（SQLite）のみを参照する。
 * 返した本・フレーズ・知識は「参照候補」として記録し、回答の出典表示に使う。
 */
import { format } from "date-fns";
import type { Db } from "@/lib/db";
import { buildBookWhere, bookListInclude } from "@/server/services/books";
import { searchAll } from "@/server/services/search";
import { analyzeTrends, type InsightPeriod } from "@/server/services/insights";
import { recommendNext } from "@/server/services/recommend";
import { STATUS_LABEL, type BookStatus } from "@/lib/constants";
import type { AiToolDef } from "./provider";

export interface SourceRefs {
  books: Map<string, string>; // id -> title
  quotes: Map<string, string>; // id -> text
  knowledge: Map<string, string>; // id -> title
}
export function newSources(): SourceRefs {
  return { books: new Map(), quotes: new Map(), knowledge: new Map() };
}

const d = (x: Date | null | undefined) => (x ? format(x, "yyyy-MM-dd") : null);
const clip = (s: string | null | undefined, n = 400) => (s ? (s.length > n ? s.slice(0, n) + "…" : s) : null);

export const LIBRARIAN_TOOLS: AiToolDef[] = [
  {
    name: "search_library",
    description: "ユーザーの本棚全体をキーワードで横断検索する。本（タイトル・著者・タグ・ジャンル）、感想・学んだこと、読書メモ、保存したフレーズ、知識ノートが対象。日本語の短いキーワードで検索すること。",
    input_schema: { type: "object", properties: { query: { type: "string", description: "検索キーワード（スペース区切りでAND検索）" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "list_books",
    description: "条件で本を一覧する。ステータス・ジャンル・タグ・読了年・著者名で絞り込める。「去年読んだ本」「政治の本」などに使う。",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["WANT_TO_READ", "OWNED", "READING", "COMPLETED", "PAUSED", "DROPPED"] },
        genre: { type: "string" },
        tag: { type: "string" },
        finished_year: { type: "integer" },
        author: { type: "string" },
        min_rating: { type: "integer", minimum: 1, maximum: 5 },
        sort: { type: "string", enum: ["finishedAt", "rating", "createdAt"] },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_book",
    description: "本の詳細を取得する。読書記録（評価・感想・要約・学んだこと・印象に残ったこと・疑問点）、読書メモ、保存したフレーズ、関連する知識を含む。",
    input_schema: { type: "object", properties: { book_id: { type: "string" } }, required: ["book_id"], additionalProperties: false },
  },
  {
    name: "search_quotes",
    description: "保存したフレーズを検索する。キーワードまたはタグで絞り込む。どちらも省略すると最近のフレーズを返す。",
    input_schema: { type: "object", properties: { query: { type: "string" }, tag: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 40 } }, additionalProperties: false },
  },
  {
    name: "list_knowledge",
    description: "知識ノートを検索・一覧する。知識同士のつながりと関連する本も返す。",
    input_schema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 40 } }, additionalProperties: false },
  },
  {
    name: "reading_overview",
    description: "読書傾向の集計（ジャンル・著者・タグ・評価・最近増えた/減ったジャンル・フレーズのタグ傾向・ジャンル一覧と冊数）を返す。",
    input_schema: { type: "object", properties: { period: { type: "string", enum: ["3m", "1y", "all"] } }, required: ["period"], additionalProperties: false },
  },
  {
    name: "recommend_candidates",
    description: "未読（読みたい・積読・中断）の本から、次に読む候補をルールベースで返す（読書ルート・シリーズ続巻・高評価著者・共通タグなどの理由付き）。",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

export async function runLibrarianTool(db: Db, name: string, rawInput: unknown, src: SourceRefs): Promise<string> {
  const input = (rawInput ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string).slice(0, 100) : undefined);
  const num = (k: string) => (typeof input[k] === "number" ? (input[k] as number) : undefined);

  switch (name) {
    case "search_library": {
      const r = await searchAll(db, str("query") ?? "", 12);
      if (!r) return JSON.stringify({ message: "検索語が空です" });
      r.books.forEach((b) => src.books.set(b.id, b.title));
      r.quotes.forEach((q) => src.quotes.set(q.id, q.text));
      r.knowledge.forEach((k) => src.knowledge.set(k.id, k.title));
      return JSON.stringify({
        books: r.books.map((b) => ({ id: b.id, title: b.title, authors: b.authors.map((a) => a.author.name), status: STATUS_LABEL[b.status as BookStatus], genre: b.genre, rating: b.rating, finishedAt: d(b.finishedAt) })),
        reviews: r.records.map((x) => ({ bookId: x.book.id, bookTitle: x.book.title, review: clip(x.review, 200), learned: clip(x.learned, 200), summary: clip(x.summary, 200) })),
        notes: r.notes.map((n) => ({ bookId: n.book.id, bookTitle: n.book.title, date: d(n.date), note: clip(n.note, 200) })),
        quotes: r.quotes.map((q) => ({ id: q.id, text: clip(q.text, 300), bookTitle: q.book?.title, page: q.pageNumber, tags: q.tags.map((t) => t.tag.name), myNote: clip(q.note, 200) })),
        knowledge: r.knowledge.map((k) => ({ id: k.id, title: k.title, content: clip(k.content, 300), category: k.category })),
      });
    }
    case "list_books": {
      const authorName = str("author");
      const where = buildBookWhere({
        status: str("status"),
        genre: str("genre"),
        tag: str("tag"),
        finishedYear: num("finished_year"),
        minRating: num("min_rating"),
        q: authorName,
      });
      const sort = str("sort") ?? "finishedAt";
      const books = await db.book.findMany({
        where,
        include: { ...bookListInclude, tags: { include: { tag: true } } },
        orderBy: sort === "rating" ? [{ rating: { sort: "desc", nulls: "last" } }] : sort === "createdAt" ? [{ createdAt: "desc" }] : [{ finishedAt: { sort: "desc", nulls: "last" } }],
        take: Math.min(50, num("limit") ?? 30),
      });
      books.forEach((b) => src.books.set(b.id, b.title));
      return JSON.stringify({
        count: books.length,
        books: books.map((b) => ({ id: b.id, title: b.title, authors: b.authors.map((a) => a.author.name), status: STATUS_LABEL[b.status as BookStatus], genre: b.genre, tags: b.tags.map((t) => t.tag.name), rating: b.rating, startedAt: d(b.startedAt), finishedAt: d(b.finishedAt), pages: b.pageCount })),
      });
    }
    case "get_book": {
      const id = str("book_id");
      if (!id) return JSON.stringify({ error: "book_id が必要です" });
      const b = await db.book.findUnique({
        where: { id },
        include: {
          authors: { include: { author: true } },
          tags: { include: { tag: true } },
          series: true,
          records: { orderBy: { createdAt: "desc" } },
          sessions: { where: { note: { not: null } }, orderBy: { date: "desc" }, take: 10 },
          quotes: { include: { tags: { include: { tag: true } } }, take: 20, orderBy: { createdAt: "desc" } },
          knowledge: { include: { knowledge: true } },
        },
      });
      if (!b) return JSON.stringify({ error: "本が見つかりません" });
      src.books.set(b.id, b.title);
      b.quotes.forEach((q) => src.quotes.set(q.id, q.text));
      b.knowledge.forEach((k) => src.knowledge.set(k.knowledge.id, k.knowledge.title));
      return JSON.stringify({
        id: b.id,
        title: b.title,
        authors: b.authors.map((a) => a.author.name),
        publisher: b.publisher,
        publishedAt: b.publishedAt,
        genre: b.genre,
        tags: b.tags.map((t) => t.tag.name),
        series: b.series?.title,
        status: STATUS_LABEL[b.status as BookStatus],
        description: clip(b.description, 300),
        records: b.records.map((r) => ({ status: r.status, startedAt: d(r.startedAt), finishedAt: d(r.finishedAt), rating: r.rating, review: clip(r.review), summary: clip(r.summary), learned: clip(r.learned), memorable: clip(r.memorable), questions: clip(r.questions) })),
        readingNotes: b.sessions.map((s) => ({ date: d(s.date), note: clip(s.note, 300) })),
        quotes: b.quotes.map((q) => ({ id: q.id, text: clip(q.text, 300), page: q.pageNumber, tags: q.tags.map((t) => t.tag.name), myNote: clip(q.note, 200) })),
        knowledge: b.knowledge.map((k) => ({ id: k.knowledge.id, title: k.knowledge.title, content: clip(k.knowledge.content, 300) })),
      });
    }
    case "search_quotes": {
      const q = str("query");
      const tag = str("tag");
      const quotes = await db.quote.findMany({
        where: {
          AND: [
            ...(q ? q.split(/\s+/).filter(Boolean).map((t) => ({ OR: [{ text: { contains: t } }, { note: { contains: t } }, { tags: { some: { tag: { name: { contains: t } } } } }, { book: { title: { contains: t } } }] })) : []),
            ...(tag ? [{ tags: { some: { tag: { name: tag } } } }] : []),
          ],
        },
        include: { tags: { include: { tag: true } }, book: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: Math.min(40, num("limit") ?? 20),
      });
      quotes.forEach((x) => src.quotes.set(x.id, x.text));
      return JSON.stringify({
        count: quotes.length,
        quotes: quotes.map((x) => ({ id: x.id, text: clip(x.text, 300), bookId: x.book?.id, bookTitle: x.book?.title, page: x.pageNumber, tags: x.tags.map((t) => t.tag.name), myNote: clip(x.note, 200), savedAt: d(x.createdAt) })),
      });
    }
    case "list_knowledge": {
      const q = str("query");
      const notes = await db.knowledgeNote.findMany({
        where: q ? { OR: q.split(/\s+/).filter(Boolean).flatMap((t) => [{ title: { contains: t } }, { content: { contains: t } }, { category: { contains: t } }, { tags: { some: { tag: { name: { contains: t } } } } }]) } : {},
        include: {
          books: { include: { book: { select: { id: true, title: true } } } },
          linksFrom: { include: { to: { select: { title: true } } } },
          linksTo: { include: { from: { select: { title: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: Math.min(40, num("limit") ?? 20),
      });
      notes.forEach((k) => src.knowledge.set(k.id, k.title));
      return JSON.stringify({
        count: notes.length,
        knowledge: notes.map((k) => ({
          id: k.id,
          title: k.title,
          content: clip(k.content, 300),
          category: k.category,
          books: k.books.map((b) => b.book.title),
          linkedTo: [...k.linksFrom.map((l) => l.to.title), ...k.linksTo.map((l) => l.from.title)],
        })),
      });
    }
    case "reading_overview": {
      const p = (str("period") as InsightPeriod) ?? "1y";
      const a = await analyzeTrends(db, ["3m", "1y", "all"].includes(p) ? p : "1y");
      const genres = await db.book.groupBy({ by: ["genre", "status"], _count: { _all: true } });
      return JSON.stringify({
        period: a.period,
        completedCount: a.total,
        topGenres: a.genres.slice(0, 10),
        topAuthors: a.authors,
        topTags: a.tags,
        quoteTags: a.quoteTags,
        increasedGenres: a.increased,
        decreasedGenres: a.decreased,
        avgRating: a.avgRating,
        allGenresByStatus: genres.map((g) => ({ genre: g.genre ?? "未分類", status: STATUS_LABEL[g.status as BookStatus], count: g._count._all })),
      });
    }
    case "recommend_candidates": {
      const recs = await recommendNext(db, 10);
      recs.forEach((r) => src.books.set(r.book.id, r.book.title));
      return JSON.stringify({ candidates: recs.map((r) => ({ id: r.book.id, title: r.book.title, authors: r.book.authors.map((a) => a.author.name), status: STATUS_LABEL[r.book.status as BookStatus], reasons: r.reasons })) });
    }
    default:
      return JSON.stringify({ error: `不明なツール: ${name}` });
  }
}
