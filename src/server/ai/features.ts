import "server-only";
/**
 * AI による整理・分析機能。生成結果はすべて「AI提案」として返し、ユーザーが承認したものだけを保存する。
 */
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { analyzeTrends, type InsightPeriod } from "@/server/services/insights";
import { getProvider } from "./provider";

/* ---------- 読書メモの整理 ---------- */
export interface OrganizedNotes {
  summary: string;
  learned: string;
  memorable: string;
  questions: string;
  keywords: string[];
}

const ORGANIZE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    learned: { type: "string" },
    memorable: { type: "string" },
    questions: { type: "string" },
    keywords: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "learned", "memorable", "questions", "keywords"],
  additionalProperties: false,
};

export async function organizeNotes(input: { bookTitle: string; text: string }): Promise<OrganizedNotes> {
  const text = input.text.trim();
  if (text.length < 10) throw new AppError("整理するには、もう少し文章を書いてください（10文字以上）", "VALIDATION");
  if (text.length > 20000) throw new AppError("文章が長すぎます（20000文字まで）", "VALIDATION");
  return getProvider().json<OrganizedNotes>({
    system: `あなたは読書メモの整理を手伝うアシスタントです。ユーザーが書いた文章だけを材料に、項目ごとに整理します。
- ユーザーの文章に書かれていない事実・解釈・本の内容を追加してはいけません。
- 文体はユーザーの言葉をできるだけ活かし、です・ます調に揃える必要はありません。
- 該当する内容が無い項目は空文字にしてください。
- 各項目は箇条書き（「- 」始まり）か短い文章で、日本語で書いてください。
- keywords はユーザーの文章に出てくる重要な語を最大8個。`,
    prompt: `本：『${input.bookTitle}』\n\n--- ユーザーの読書メモ ---\n${text}\n--- ここまで ---\n\n上のメモを summary（要約）/ learned（学んだこと）/ memorable（印象に残った点）/ questions（疑問点）/ keywords に整理してください。`,
    schema: ORGANIZE_SCHEMA,
  });
}

/* ---------- フレーズ分析 ---------- */
export interface QuoteAnalysis {
  themes: string[];
  suggestedTags: string[];
  relatedKnowledgeIds: string[];
  relatedQuoteIds: string[];
  knowledgeDraft: { title: string; content: string };
  comment: string;
}

const QUOTE_SCHEMA = {
  type: "object",
  properties: {
    themes: { type: "array", items: { type: "string" } },
    suggestedTags: { type: "array", items: { type: "string" } },
    relatedKnowledgeIds: { type: "array", items: { type: "string" } },
    relatedQuoteIds: { type: "array", items: { type: "string" } },
    knowledgeDraft: {
      type: "object",
      properties: { title: { type: "string" }, content: { type: "string" } },
      required: ["title", "content"],
      additionalProperties: false,
    },
    comment: { type: "string" },
  },
  required: ["themes", "suggestedTags", "relatedKnowledgeIds", "relatedQuoteIds", "knowledgeDraft", "comment"],
  additionalProperties: false,
};

export async function analyzeQuote(db: Db, quoteId: string) {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    include: { tags: { include: { tag: true } }, book: { select: { title: true, authors: { include: { author: true } } } } },
  });
  if (!quote) throw new NotFoundError("フレーズ");
  const [others, knowledge, tags] = await Promise.all([
    db.quote.findMany({ where: { id: { not: quoteId } }, select: { id: true, text: true, book: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 120 }),
    db.knowledgeNote.findMany({ select: { id: true, title: true, content: true }, orderBy: { updatedAt: "desc" }, take: 120 }),
    db.tag.findMany({ select: { name: true }, take: 300 }),
  ]);
  const result = await getProvider().json<QuoteAnalysis>({
    system: `あなたは読書フレーズの整理を手伝うアシスタントです。提案はユーザーが確認してから採用します。
- themes: フレーズのテーマを短い語で最大4つ。
- suggestedTags: 付けると良いタグを最大5つ。既存タグ一覧にあるものを優先し、既に付いているタグは除外。
- relatedKnowledgeIds / relatedQuoteIds: 一覧の中から内容的に関連が深いものの ID だけを最大5件ずつ。無理に選ばず、無ければ空配列。
- knowledgeDraft: このフレーズとユーザーのメモから作れる「知識ノート」の案。フレーズに書かれていない事実を断定的に付け加えないこと。content は200字程度。
- comment: なぜそう提案したかを1〜2文で。ユーザーの考えを断定しないこと。`,
    prompt: JSON.stringify({
      quote: { text: quote.text, book: quote.book?.title, authors: quote.book?.authors.map((a) => a.author.name), page: quote.pageNumber, tags: quote.tags.map((t) => t.tag.name), myNote: quote.note },
      existingTags: tags.map((t) => t.name),
      knowledgeList: knowledge.map((k) => ({ id: k.id, title: k.title, content: k.content.slice(0, 120) })),
      otherQuotes: others.map((o) => ({ id: o.id, text: o.text.slice(0, 120), book: o.book?.title })),
    }),
    schema: QUOTE_SCHEMA,
  });
  const kMap = new Map(knowledge.map((k) => [k.id, k.title]));
  const qMap = new Map(others.map((o) => [o.id, { text: o.text, book: o.book?.title ?? null }]));
  const existing = new Set(quote.tags.map((t) => t.tag.name));
  return {
    themes: result.themes.slice(0, 4),
    suggestedTags: result.suggestedTags.map((t) => t.replace(/^#/, "").trim()).filter((t) => t && !existing.has(t)).slice(0, 5),
    relatedKnowledge: result.relatedKnowledgeIds.filter((id) => kMap.has(id)).slice(0, 5).map((id) => ({ id, title: kMap.get(id)! })),
    relatedQuotes: result.relatedQuoteIds.filter((id) => qMap.has(id)).slice(0, 5).map((id) => ({ id, ...qMap.get(id)! })),
    knowledgeDraft: result.knowledgeDraft,
    comment: result.comment,
  };
}
export type QuoteAnalysisResult = Awaited<ReturnType<typeof analyzeQuote>>;

/* ---------- 読書傾向の文章化 ---------- */
export async function summarizeTrends(db: Db, period: InsightPeriod) {
  const a = await analyzeTrends(db, period);
  const recent = await db.book.findMany({
    where: { status: { in: ["COMPLETED", "READING"] } },
    select: { title: true, genre: true, status: true, rating: true, tags: { select: { tag: { select: { name: true } } } } },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  return getProvider().json<{ overview: string; themes: string[]; suggestions: string[] }>({
    system: `あなたは読書傾向を説明するアシスタントです。与えられた集計データだけを根拠に、日本語で説明します。
- 断定しすぎず「登録データを見ると〜という傾向があります」「最近は〜に関する本が増えています」のように表現する。
- ユーザーの性格や考えを決めつけない。
- データから言えないことは書かない。推測を述べる場合は推測であると明示する。
- overview は3〜5文。themes は最近よく読んでいるテーマを最大5つ。suggestions は今後の読書の提案を最大3つ（本棚にあるかどうか不明な一般的な提案であることが分かる表現で）。`,
    prompt: JSON.stringify({ period, analysis: a, recentBooks: recent.map((b) => ({ title: b.title, genre: b.genre, status: b.status, rating: b.rating, tags: b.tags.map((t) => t.tag.name) })) }),
    schema: {
      type: "object",
      properties: { overview: { type: "string" }, themes: { type: "array", items: { type: "string" } }, suggestions: { type: "array", items: { type: "string" } } },
      required: ["overview", "themes", "suggestions"],
      additionalProperties: false,
    },
  });
}
