import "server-only";
/**
 * AI 司書：会話の保存、AI による回答、AI が使えない場合のローカル検索モード
 */
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { getSettings } from "@/server/services/settings";
import { searchAll } from "@/server/services/search";
import { bookListInclude } from "@/server/services/books";
import { aiConfig } from "./config";
import { aiErrorMessage, getProvider, type ChatTurn } from "./provider";
import { LIBRARIAN_TOOLS, newSources, runLibrarianTool, type SourceRefs } from "./tools";

export interface AnswerSources {
  books: { id: string; title: string }[];
  quotes: { id: string; text: string }[];
  knowledge: { id: string; title: string }[];
}

const SYSTEM = `あなたは「BookNest」というアプリのAI司書です。ユーザー本人の読書記録（本棚・読書履歴・感想・読書メモ・保存したフレーズ・知識ノート）を調べ、日本語で質問に答えます。

# 進め方
- 回答の前に、必ずツールでアプリ内データを調べてください。推測で本やフレーズを挙げてはいけません。
- 「去年」「今年」などの相対的な日付は、今日の日付（{today}）を基準に解釈してください。
- 必要に応じて複数のツールを組み合わせ、具体的な本・フレーズ・知識を根拠にしてください。

# 回答のルール
- データから分かる事実と、あなたの推測・提案をはっきり区別してください。推測には「〜かもしれません」「〜と考えられます」を使います。
- ユーザーの考えや気持ちを断定しないでください（×「あなたは〜と考えています」）。代わりに「登録データを見ると、〜という傾向があります」「〜というメモを残しています」のように、データにもとづいて述べてください。
- データに無いことは「登録データには見当たりません」と正直に伝えてください。
- 本のタイトルは『』で、フレーズは「」で示してください。
- 簡潔に。見出しは使わず、短い段落と箇条書き（「- 」）で読みやすくまとめてください。**太字** は重要な語句にだけ使えます。
- アプリ外の本を薦める場合は、ユーザーの本棚には無い一般的な提案であることを明記してください。

# 出典
回答の最後に、回答の根拠として実際に使った本・フレーズ・知識のIDを次の形式で1行だけ付けてください（ツール結果に含まれていたIDのみ）。この行はユーザーには表示されません。
<sources>{"books":["ID"],"quotes":["ID"],"knowledge":["ID"]}</sources>`;

function parseSources(text: string, src: SourceRefs): { answer: string; sources: AnswerSources } {
  const m = text.match(/<sources>([\s\S]*?)<\/sources>\s*$/);
  const answer = text.replace(/<sources>[\s\S]*?<\/sources>\s*$/, "").trim();
  let ids: { books?: string[]; quotes?: string[]; knowledge?: string[] } = {};
  if (m) {
    try {
      ids = JSON.parse(m[1]);
    } catch {
      ids = {};
    }
  }
  // AI が示した ID のうち、実際にツールが返したものだけを採用する（存在しない出典を防ぐ）
  let books = (ids.books ?? []).filter((id) => src.books.has(id)).map((id) => ({ id, title: src.books.get(id)! }));
  const quotes = (ids.quotes ?? []).filter((id) => src.quotes.has(id)).map((id) => ({ id, text: src.quotes.get(id)! }));
  const knowledge = (ids.knowledge ?? []).filter((id) => src.knowledge.has(id)).map((id) => ({ id, title: src.knowledge.get(id)! }));
  if (!m) {
    // 出典行が無い場合は、回答中に『タイトル』が登場する本を出典とする
    books = [...src.books.entries()].filter(([, t]) => answer.includes(`『${t}』`)).map(([id, title]) => ({ id, title }));
  }
  return { answer, sources: { books: dedupe(books), quotes: dedupe(quotes), knowledge: dedupe(knowledge) } };
}

function dedupe<T extends { id: string }>(arr: T[]) {
  return arr.filter((x, i) => arr.findIndex((y) => y.id === x.id) === i).slice(0, 20);
}

/* ---------------- ローカル検索モード（AI 未設定・オフ時） ---------------- */
const STOP = /(印象に残った|去年|昨年|今年|を教えて|教えて|ください|について|に関する|に関して|ありますか|ある？|あった|ですか|でしょうか|って何|とは|したい|ほしい|欲しい|探して|見せて|整理して|まとめて|から|自分が|自分の|私の|僕の|今まで|これまで|最近|保存した|読んだ|読んでいる|本|もの|こと|ため|どんな|何|なに|どれ|ある|いる|する|なる|ような|みたいな)/g;

export function extractKeywords(q: string): string[] {
  const cleaned = q.normalize("NFKC").replace(/[？?！!。、,.「」『』（）()]/g, " ").replace(STOP, " ");
  const parts = cleaned.split(/[\sのはがをにでとへもや]+/).map((s) => s.trim()).filter((s) => s.length >= 2);
  return Array.from(new Set(parts)).slice(0, 5);
}

async function localAnswer(db: Db, question: string, reason: string): Promise<{ answer: string; sources: AnswerSources }> {
  const now = new Date();
  const year = /去年|昨年/.test(question) ? now.getFullYear() - 1 : /今年/.test(question) ? now.getFullYear() : Number(question.match(/(20\d{2}|19\d{2})年/)?.[1]) || null;
  const books = new Map<string, string>();
  const quotes = new Map<string, string>();
  const knowledge = new Map<string, string>();
  const lines: string[] = [`${reason}アプリ内データの検索結果を表示します。`];

  if (year) {
    const done = await db.book.findMany({
      where: { finishedAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      include: bookListInclude,
      orderBy: [{ rating: { sort: "desc", nulls: "last" } }],
      take: 20,
    });
    if (done.length) {
      lines.push(`\n${year}年に読了した本（評価順）:`);
      for (const b of done) {
        books.set(b.id, b.title);
        lines.push(`- 『${b.title}』${b.rating ? ` ★${b.rating}` : ""}`);
      }
    }
  }
  const keywords = extractKeywords(question);
  for (const k of keywords) {
    const r = await searchAll(db, k, 8);
    if (!r) continue;
    r.books.forEach((b) => books.set(b.id, b.title));
    r.quotes.forEach((q) => quotes.set(q.id, q.text));
    r.knowledge.forEach((n) => knowledge.set(n.id, n.title));
  }
  if (keywords.length) lines.push(`\nキーワード：${keywords.map((k) => `「${k}」`).join(" ")}`);
  if (books.size) lines.push(`\n関連する本：\n${[...books.values()].slice(0, 10).map((t) => `- 『${t}』`).join("\n")}`);
  if (quotes.size) lines.push(`\n関連するフレーズ：\n${[...quotes.values()].slice(0, 5).map((t) => `- 「${t.length > 60 ? t.slice(0, 60) + "…" : t}」`).join("\n")}`);
  if (knowledge.size) lines.push(`\n関連する知識：\n${[...knowledge.values()].slice(0, 5).map((t) => `- ${t}`).join("\n")}`);
  if (!books.size && !quotes.size && !knowledge.size) lines.push("\n該当するデータは見つかりませんでした。別のキーワードでお試しください。");
  return {
    answer: lines.join("\n"),
    sources: {
      books: [...books].slice(0, 20).map(([id, title]) => ({ id, title })),
      quotes: [...quotes].slice(0, 20).map(([id, text]) => ({ id, text })),
      knowledge: [...knowledge].slice(0, 20).map(([id, title]) => ({ id, title })),
    },
  };
}

export async function aiAvailable(db: Db) {
  const cfg = aiConfig();
  if (!cfg.configured) return { ok: false as const, reason: "AIが未設定のため、" };
  const s = await getSettings(db);
  if (!s.aiEnabled) return { ok: false as const, reason: "AI機能がオフのため、" };
  return { ok: true as const, reason: "" };
}

export async function askLibrarian(db: Db, conversationId: string | null, question: string) {
  const q = question.trim();
  if (!q) throw new AppError("質問を入力してください", "VALIDATION");
  if (q.length > 2000) throw new AppError("質問は2000文字以内で入力してください", "VALIDATION");

  let conv = conversationId ? await db.aIConversation.findUnique({ where: { id: conversationId }, include: { messages: { orderBy: { createdAt: "asc" } } } }) : null;
  if (conversationId && !conv) throw new NotFoundError("会話");
  if (!conv) conv = { ...(await db.aIConversation.create({ data: { title: q.slice(0, 40) } })), messages: [] };

  await db.aIMessage.create({ data: { conversationId: conv.id, role: "user", content: q } });

  const avail = await aiAvailable(db);
  let result: { answer: string; sources: AnswerSources };
  let mode: "ai" | "local" = "local";
  if (avail.ok) {
    try {
      const provider = getProvider();
      const src = newSources();
      const history: ChatTurn[] = conv.messages.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      history.push({ role: "user", content: q });
      const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
      const text = await provider.chat({
        system: SYSTEM.replace("{today}", today),
        messages: history,
        tools: LIBRARIAN_TOOLS,
        runTool: (name, input) => runLibrarianTool(db, name, input, src),
      });
      result = parseSources(text, src);
      mode = "ai";
    } catch (e) {
      const local = await localAnswer(db, q, `${aiErrorMessage(e)}\n代わりに、`);
      result = local;
    }
  } else {
    result = await localAnswer(db, q, avail.reason);
  }

  const msg = await db.aIMessage.create({
    data: { conversationId: conv.id, role: "assistant", content: result.answer, sources: JSON.stringify({ ...result.sources, mode }) },
  });
  await db.aIConversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } });
  return { conversationId: conv.id, message: { id: msg.id, role: "assistant", content: result.answer, sources: result.sources, mode } };
}

export function parseStoredSources(s: string | null): (AnswerSources & { mode?: string }) | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
