import type { Db } from "@/lib/db";
import { bookListInclude, buildBookWhere } from "./books";

/** 横断検索：本・読書記録（感想/要約/学んだこと）・フレーズ・知識・読書メモ */
export async function searchAll(db: Db, q: string, take = 20) {
  const terms = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!terms.length) return null;

  const recordWhere = {
    AND: terms.map((t) => ({
      OR: [
        { review: { contains: t } },
        { summary: { contains: t } },
        { learned: { contains: t } },
        { memorable: { contains: t } },
        { questions: { contains: t } },
      ],
    })),
  };
  const quoteWhere = {
    AND: terms.map((t) => ({
      OR: [
        { text: { contains: t } },
        { note: { contains: t } },
        { pageNumber: { contains: t } },
        { tags: { some: { tag: { name: { contains: t } } } } },
        { book: { title: { contains: t } } },
        { book: { authors: { some: { author: { name: { contains: t } } } } } },
      ],
    })),
  };
  const knowledgeWhere = {
    AND: terms.map((t) => ({
      OR: [
        { title: { contains: t } },
        { content: { contains: t } },
        { category: { contains: t } },
        { tags: { some: { tag: { name: { contains: t } } } } },
      ],
    })),
  };
  const sessionWhere = { AND: terms.map((t) => ({ note: { contains: t } })) };

  const creativeWhere = { AND: terms.map((t) => ({ OR: [{ title: { contains: t } }, { content: { contains: t } }, { tags: { some: { tag: { name: { contains: t } } } } }] })) };
  const projectWhere = { AND: terms.map((t) => ({ OR: [{ title: { contains: t } }, { logline: { contains: t } }, { synopsis: { contains: t } }, { theme: { contains: t } }] })) };
  const [books, bookCount, records, quotes, quoteCount, knowledge, knowledgeCount, notes, authors, creativeNotes, projects] = await Promise.all([
    db.book.findMany({ where: buildBookWhere({ q }), include: bookListInclude, take, orderBy: { updatedAt: "desc" } }),
    db.book.count({ where: buildBookWhere({ q }) }),
    db.readingRecord.findMany({
      where: recordWhere,
      include: { book: { select: { id: true, title: true, coverImage: true } } },
      take,
      orderBy: { updatedAt: "desc" },
    }),
    db.quote.findMany({
      where: quoteWhere,
      include: { tags: { include: { tag: true } }, book: { select: { id: true, title: true, authors: { include: { author: true } } } }, knowledge: { include: { knowledge: { select: { id: true, title: true } } } } },
      take,
      orderBy: { createdAt: "desc" },
    }),
    db.quote.count({ where: quoteWhere }),
    db.knowledgeNote.findMany({ where: knowledgeWhere, include: { _count: { select: { books: true } } }, take, orderBy: { updatedAt: "desc" } }),
    db.knowledgeNote.count({ where: knowledgeWhere }),
    db.readingSession.findMany({
      where: sessionWhere,
      include: { book: { select: { id: true, title: true } } },
      take,
      orderBy: { date: "desc" },
    }),
    db.author.findMany({
      where: { AND: terms.map((t) => ({ OR: [{ name: { contains: t } }, { nameKana: { contains: t } }] })) },
      include: { _count: { select: { books: true } } },
      take: 10,
    }),
    db.creativeNote.findMany({ where: creativeWhere, select: { id: true, title: true, content: true, category: true }, orderBy: { updatedAt: "desc" }, take }),
    db.novelProject.findMany({ where: projectWhere, select: { id: true, title: true, logline: true }, orderBy: { updatedAt: "desc" }, take: 10 }),
  ]);
  return { terms, books, bookCount, records, quotes, quoteCount, knowledge, knowledgeCount, notes, authors, creativeNotes, projects };
}

/** テキストの中から検索語周辺を抜き出す */
export function snippet(text: string, terms: string[], radius = 40) {
  const lower = text.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    idx = lower.indexOf(t.toLowerCase());
    if (idx >= 0) break;
  }
  if (idx < 0) return text.slice(0, radius * 2) + (text.length > radius * 2 ? "…" : "");
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}
