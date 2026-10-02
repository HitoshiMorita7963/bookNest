/**
 * 知識のカテゴリ提案。
 * 表記ゆれでカテゴリが増えないよう、既にあるカテゴリを優先する：
 *  1. 同じ本・同じフレーズ・同じタグ・内容が近い知識が使っているカテゴリ
 *  2. 関連する本のジャンル、本文のキーワード（既存カテゴリに似た名前があればそちらに寄せる）
 */
import type { Db } from "@/lib/db";
import { isFictionGenre, topicsFromText } from "@/lib/classify";
import { bigrams } from "./creative";

export interface CategoryInput {
  title: string;
  content?: string | null;
  tags?: string[];
  bookIds?: string[];
  quoteIds?: string[];
  /** 編集中の知識自身は比較対象から外す */
  excludeId?: string | null;
}

export interface CategorySuggestion {
  name: string;
  reason: string;
  /** 既にあるカテゴリか（新しいカテゴリを作ることになるか） */
  existing: boolean;
}

const norm = (s: string) => s.normalize("NFKC").trim().toLowerCase();

/** 既存カテゴリの中で、名前が一致・包含するもの（「経済」→「経済学」など） */
function matchExisting(name: string, existing: string[]): string | null {
  const n = norm(name);
  return existing.find((c) => norm(c) === n) ?? existing.find((c) => norm(c).includes(n) || n.includes(norm(c))) ?? null;
}

type KnowledgeRow = { id: string; title: string; content: string; category: string | null; books: { bookId: string }[]; quotes: { quoteId: string }[]; tags: { tag: { name: string } }[] };

export async function loadCategoryContext(db: Db) {
  const notes = (await db.knowledgeNote.findMany({
    select: { id: true, title: true, content: true, category: true, books: { select: { bookId: true } }, quotes: { select: { quoteId: true } }, tags: { select: { tag: { select: { name: true } } } } },
    take: 2000,
  })) as KnowledgeRow[];
  const existing = [...new Set(notes.map((n) => n.category?.trim()).filter((c): c is string => !!c))];
  return { notes, existing };
}

/** ルールベースのカテゴリ提案（最大3件、スコアの高い順） */
export async function suggestCategoriesByRules(db: Db, input: CategoryInput, ctx?: Awaited<ReturnType<typeof loadCategoryContext>>): Promise<CategorySuggestion[]> {
  const { notes, existing } = ctx ?? (await loadCategoryContext(db));
  const scores = new Map<string, { score: number; reasons: string[] }>();
  const add = (name: string, score: number, reason: string) => {
    const s = scores.get(name) ?? { score: 0, reasons: [] };
    s.score += score;
    if (!s.reasons.includes(reason)) s.reasons.push(reason);
    scores.set(name, s);
  };

  const bookIds = new Set(input.bookIds ?? []);
  const quoteIds = new Set(input.quoteIds ?? []);
  const tags = new Set((input.tags ?? []).map(norm));
  const base = bigrams(`${input.title} ${input.content ?? ""}`);
  for (const n of notes) {
    if (!n.category || n.id === input.excludeId) continue;
    if (n.books.some((b) => bookIds.has(b.bookId))) add(n.category, 3, "同じ本から得た知識のカテゴリ");
    if (n.quotes.some((q) => quoteIds.has(q.quoteId))) add(n.category, 3, "同じフレーズから得た知識のカテゴリ");
    const sharedTags = n.tags.filter((t) => tags.has(norm(t.tag.name))).length;
    if (sharedTags) add(n.category, sharedTags, "同じタグの知識のカテゴリ");
    if (base.size >= 2) {
      const g = bigrams(`${n.title} ${n.content}`);
      let inter = 0;
      for (const x of base) if (g.has(x)) inter++;
      const sim = inter / Math.max(1, Math.min(base.size, g.size));
      if (sim >= 0.15) add(n.category, sim * 5, `内容が近い知識「${n.title}」のカテゴリ`);
    }
  }

  // 本のジャンル・本文のキーワード（既存カテゴリに似た名前があれば寄せる）
  if (bookIds.size) {
    const books = await db.book.findMany({ where: { id: { in: [...bookIds] } }, select: { genre: true } });
    for (const b of books) {
      if (!b.genre || isFictionGenre(b.genre) || b.genre === "新書" || b.genre === "その他") continue;
      add(matchExisting(b.genre, existing) ?? b.genre, 1.5, "関連する本のジャンル");
    }
  }
  for (const topic of topicsFromText(`${input.title}\n${input.content ?? ""}\n${[...(input.tags ?? [])].join(" ")}`)) {
    add(matchExisting(topic, existing) ?? topic, 1, "内容のキーワード");
  }

  return [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 3)
    .map(([name, s]) => ({ name, reason: s.reasons[0], existing: existing.includes(name) }));
}
