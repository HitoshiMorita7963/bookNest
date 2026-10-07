import "server-only";
/**
 * AI 編集者：作品ごとの創作相談。
 * 既存の AI 司書（プロバイダ・読書データ検索ツール・出典表示・会話保存・検索モード）を拡張している。
 * AI はデータを直接変更せず、変更は「提案」として返し、ユーザーが採用したものだけを保存する。
 */
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { searchAll } from "@/server/services/search";
import { CREATIVE_CATEGORIES } from "@/lib/constants";
import { aiErrorMessage, getProvider, type ChatTurn } from "./provider";
import { LIBRARIAN_TOOLS, newSources, runLibrarianTool } from "./tools";
import { CREATIVE_TOOLS, remember, runCreativeTool, type CreativeRef, type CreativeRefs } from "./creative-tools";
import { aiAvailable, extractKeywords } from "./librarian";
import { quoted } from "@/lib/quote-marks";

export interface EditorContext {
  chapterId?: string | null;
  characterId?: string | null;
  /** 関連する創作メモ・作品データを検索してよいか */
  includeNotes?: boolean;
  /** 本・フレーズ・知識など読書データを検索してよいか */
  includeReading?: boolean;
}

export interface EditorSources {
  books: { id: string; title: string }[];
  quotes: { id: string; text: string }[];
  knowledge: { id: string; title: string }[];
  creative: CreativeRef[];
}

/** AI の変更提案（採用するまで保存されない） */
export type Proposal =
  | { type: "update"; target: UpdatableTarget; id: string; field: string; value: string; reason?: string; label?: string }
  | { type: "create_note"; title: string; content: string; category: string; reason?: string };

export type UpdatableTarget = "project" | "character" | "world" | "plot" | "chapter" | "scene";
export const UPDATABLE_FIELDS: Record<UpdatableTarget, Record<string, string>> = {
  project: { logline: "一行あらすじ", synopsis: "作品概要", theme: "テーマ", genre: "ジャンル" },
  character: { role: "役割", age: "年齢", appearance: "外見", personality: "性格", background: "過去", goal: "目的", conflict: "葛藤", speechStyle: "話し方", notes: "メモ" },
  world: { content: "内容" },
  plot: { summary: "概要", notes: "メモ" },
  chapter: { summary: "概要" },
  scene: { summary: "概要", content: "下書き" },
};

const SYSTEM = `あなたは「BookNest」の AI 編集者です。ユーザーが書いている小説について、ユーザー本人の読書データ（本・フレーズ・知識・読書記録）と創作データ（創作メモ・人物・世界観・プロット・章・シーン）を必要に応じてツールで検索しながら、日本語で相談に乗ります。今日は {today} です。

# 進め方
- 回答の前に、必要なデータをツールで調べてください。推測で本・フレーズ・人物の設定を作ってはいけません。
- 「関連する読書資料」を聞かれたら、list_project_references と search_library / search_quotes / list_knowledge を組み合わせて探してください。
- 似たアイデアを聞かれたら find_similar_notes を使ってください。

# 回答の形式（必要な見出しだけ使う）
【現在保存されている情報】ユーザーが実際に保存している内容（出典が分かるように）
【AIによる整理】保存された情報の整理・要約
【考えられる選択肢】複数の方向性
【提案】あなたのおすすめ
- 保存されている情報と、あなたの推測・提案を絶対に混同しないでください。推測には「〜かもしれません」を使います。
- ユーザーの意図や考えを断定しないでください。
- 本のタイトルは『』、フレーズは「」で示し、簡潔に。箇条書きは「- 」。

# データの変更について
あなたはデータを直接変更できません。人物・世界観・プロット・章・シーン・作品の項目を書き換える案や、新しい創作メモの案があるときだけ、回答の最後に次の形式で提案を付けてください（ユーザーが採用・編集・却下を選びます）。
<proposals>[{"type":"update","target":"character","id":"人物ID","field":"goal","value":"新しい内容","reason":"理由"},{"type":"create_note","title":"題","content":"内容","category":"CHARACTER"}]</proposals>
- target は project / character / world / plot / chapter / scene。field は次のみ：
  project: logline, synopsis, theme, genre ／ character: role, age, appearance, personality, background, goal, conflict, speechStyle, notes ／ world: content ／ plot: summary, notes ／ chapter: summary ／ scene: summary, content
- id はツール結果や作品情報に含まれる ID だけを使ってください。value は項目全体の新しい内容です。
- category は CHARACTER, SETTING, PLOT, SCENE, DIALOGUE, DESCRIPTION, THEME, MOTIF, TITLE, OTHER のいずれか。

# 出典
最後に、実際に参考にしたデータの ID を1行で付けてください（ツール結果にあった ID のみ）。
<sources>{"books":[],"quotes":[],"knowledge":[],"creative":["note:ID","character:ID","chapter:ID","scene:ID","world:ID","plot:ID"]}</sources>`;

const clip = (s: string | null | undefined, n: number) => (s ? (s.length > n ? s.slice(0, n) + "…" : s) : "");

/** 作品の基本情報と、ユーザーが選んだ対象（章・人物）だけをプロンプトに含める */
async function buildContext(db: Db, projectId: string, ctx: EditorContext) {
  const p = await db.novelProject.findUnique({
    where: { id: projectId },
    include: { characters: { select: { id: true, name: true, role: true }, orderBy: { position: "asc" } }, chapters: { select: { id: true, title: true }, orderBy: { position: "asc" } } },
  });
  if (!p) throw new NotFoundError("作品");
  const lines = [
    `# 現在の作品（ID: ${p.id}）`,
    `タイトル：${p.title}`,
    p.logline ? `一行あらすじ：${p.logline}` : "",
    p.genre ? `ジャンル：${p.genre}` : "",
    p.theme ? `テーマ：${p.theme}` : "",
    p.synopsis ? `作品概要：${clip(p.synopsis, 800)}` : "",
    `人物：${p.characters.map((c) => `${c.name}${c.role ? `（${c.role}）` : ""} [ID:${c.id}]`).join("、") || "なし"}`,
    `章：${p.chapters.map((c) => `${c.title} [ID:${c.id}]`).join("、") || "なし"}`,
  ];
  const focus: CreativeRef[] = [];
  if (ctx.chapterId) {
    const ch = await db.chapter.findFirst({ where: { id: ctx.chapterId, projectId }, include: { scenes: { orderBy: { position: "asc" } } } });
    if (ch) {
      lines.push(`\n# ユーザーが選んだ章：${ch.title} [ID:${ch.id}]`, ch.summary ? `概要：${clip(ch.summary, 600)}` : "", ...ch.scenes.map((s) => `- シーン「${s.title}」[ID:${s.id}]（${s.status}）${s.summary ? `：${clip(s.summary, 200)}` : ""}`));
      focus.push({ kind: "chapter", id: ch.id, label: ch.title, href: `/creative/projects/${projectId}/chapters/${ch.id}` });
    }
  }
  if (ctx.characterId) {
    const c = await db.character.findFirst({ where: { id: ctx.characterId, projectId } });
    if (c) {
      lines.push(
        `\n# ユーザーが選んだ人物：${c.name} [ID:${c.id}]`,
        ...(
          [
            ["役割", c.role],
            ["年齢", c.age],
            ["性格", c.personality],
            ["過去", c.background],
            ["目的", c.goal],
            ["葛藤", c.conflict],
            ["話し方", c.speechStyle],
            ["メモ", c.notes],
          ] as const
        )
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}：${clip(v, 400)}`),
      );
      focus.push({ kind: "character", id: c.id, label: c.name, href: `/creative/projects/${projectId}/characters/${c.id}` });
    }
  }
  return { project: p, text: lines.filter(Boolean).join("\n"), focus };
}

function parseOutput(text: string, books: Map<string, string>, quotes: Map<string, string>, knowledge: Map<string, string>, refs: CreativeRefs) {
  let answer = text;
  const take = (tag: string) => {
    const m = answer.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
    answer = answer.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, "g"), "");
    return m?.[1];
  };
  const srcRaw = take("sources");
  const propRaw = take("proposals");
  answer = answer.trim();
  let ids: { books?: string[]; quotes?: string[]; knowledge?: string[]; creative?: string[] } = {};
  try {
    ids = srcRaw ? JSON.parse(srcRaw) : {};
  } catch {
    ids = {};
  }
  let proposals: unknown[] = [];
  try {
    proposals = propRaw ? JSON.parse(propRaw) : [];
  } catch {
    proposals = [];
  }
  // 実際にツールが返したデータだけを出典として採用する
  const sources: EditorSources = srcRaw
    ? {
        books: (ids.books ?? []).filter((id) => books.has(id)).map((id) => ({ id, title: books.get(id)! })),
        quotes: (ids.quotes ?? []).filter((id) => quotes.has(id)).map((id) => ({ id, text: quotes.get(id)! })),
        knowledge: (ids.knowledge ?? []).filter((id) => knowledge.has(id)).map((id) => ({ id, title: knowledge.get(id)! })),
        creative: (ids.creative ?? []).filter((k) => refs.has(k)).map((k) => refs.get(k)!),
      }
    : {
        books: [...books].filter(([, t]) => answer.includes(`『${t}』`)).map(([id, title]) => ({ id, title })),
        quotes: [],
        knowledge: [...knowledge].filter(([, t]) => answer.includes(t)).map(([id, title]) => ({ id, title })),
        creative: [...refs.values()].filter((r) => answer.includes(r.label)),
      };
  return { answer, sources, proposals: Array.isArray(proposals) ? proposals : [] };
}

/** 提案の検証：作品に属するデータ・許可された項目だけを残す */
async function validateProposals(db: Db, projectId: string, raw: unknown[]): Promise<Proposal[]> {
  const out: Proposal[] = [];
  for (const r of raw.slice(0, 6)) {
    if (!r || typeof r !== "object") continue;
    const p = r as Record<string, unknown>;
    if (p.type === "create_note" && typeof p.title === "string" && typeof p.content === "string") {
      const category = (CREATIVE_CATEGORIES as readonly string[]).includes(String(p.category)) ? String(p.category) : "OTHER";
      out.push({ type: "create_note", title: p.title.slice(0, 120), content: p.content.slice(0, 5000), category, reason: typeof p.reason === "string" ? p.reason.slice(0, 300) : undefined });
      continue;
    }
    if (p.type !== "update" || typeof p.value !== "string" || typeof p.field !== "string" || typeof p.id !== "string") continue;
    const target = p.target as UpdatableTarget;
    if (!(target in UPDATABLE_FIELDS) || !(p.field in UPDATABLE_FIELDS[target])) continue;
    const label = await targetLabel(db, projectId, target, p.id);
    if (!label) continue;
    out.push({ type: "update", target, id: p.id, field: p.field, value: p.value.slice(0, 20000), reason: typeof p.reason === "string" ? p.reason.slice(0, 300) : undefined, label });
  }
  return out;
}

export async function targetLabel(db: Db, projectId: string, target: UpdatableTarget, id: string): Promise<string | null> {
  switch (target) {
    case "project":
      return id === projectId ? "作品" : null;
    case "character":
      return (await db.character.findFirst({ where: { id, projectId }, select: { name: true } }))?.name ?? null;
    case "world":
      return (await db.worldSetting.findFirst({ where: { id, projectId }, select: { title: true } }))?.title ?? null;
    case "plot":
      return (await db.plot.findFirst({ where: { id, projectId }, select: { title: true } }))?.title ?? null;
    case "chapter":
      return (await db.chapter.findFirst({ where: { id, projectId }, select: { title: true } }))?.title ?? null;
    case "scene":
      return (await db.scene.findFirst({ where: { id, chapter: { projectId } }, select: { title: true } }))?.title ?? null;
  }
}

/* ---------------- AI が使えない場合の検索モード ---------------- */

async function localEditorAnswer(db: Db, projectId: string, question: string, ctx: EditorContext, reason: string) {
  const books = new Map<string, string>();
  const quotes = new Map<string, string>();
  const knowledge = new Map<string, string>();
  const refs: CreativeRefs = new Map();
  const lines = [`${reason}作品のデータとアプリ内の検索結果を表示します。`];

  // 作品の参考資料（読書資料を探したいときに最も役立つ）
  const links = await db.creativeLink.findMany({
    where: { projectId },
    include: {
      book: { select: { id: true, title: true } },
      quote: { select: { id: true, text: true, book: { select: { id: true, title: true } } } },
      knowledge: { select: { id: true, title: true } },
      // 創作メモの元になった読書資料もたどる
      note: { select: { id: true, title: true, materials: { select: { book: { select: { id: true, title: true } }, quote: { select: { id: true, text: true } }, knowledge: { select: { id: true, title: true } } } } } },
    },
    take: 40,
  });
  if (ctx.includeReading !== false) {
    for (const l of links) {
      if (l.book) books.set(l.book.id, l.book.title);
      if (l.quote) quotes.set(l.quote.id, l.quote.text);
      if (l.quote?.book) books.set(l.quote.book.id, l.quote.book.title);
      if (l.knowledge) knowledge.set(l.knowledge.id, l.knowledge.title);
      for (const m of l.note?.materials ?? []) {
        if (m.book) books.set(m.book.id, m.book.title);
        if (m.quote) quotes.set(m.quote.id, m.quote.text);
        if (m.knowledge) knowledge.set(m.knowledge.id, m.knowledge.title);
      }
    }
  }
  if (ctx.includeNotes !== false) for (const l of links) if (l.note) remember(refs, { kind: "note", id: l.note.id, label: l.note.title, href: `/creative/notes/${l.note.id}` });

  const keywords = extractKeywords(question).filter((k) => !/読書資料|資料|関連|相談|整理|作品/.test(k));
  for (const k of keywords) {
    if (ctx.includeReading !== false) {
      const r = await searchAll(db, k, 6);
      r?.books.forEach((b) => books.set(b.id, b.title));
      r?.quotes.forEach((q) => quotes.set(q.id, q.text));
      r?.knowledge.forEach((n) => knowledge.set(n.id, n.title));
    }
    if (ctx.includeNotes !== false) {
      await runCreativeTool(db, "search_creative", { query: k, scope: "all" }, projectId, refs, { books, quotes, knowledge });
    }
    // 創作知識（一般的な創作の知識）も探す
    await runCreativeTool(db, "search_creative_knowledge", { query: k }, projectId, refs, { books, quotes, knowledge });
  }
  if (keywords.length) lines.push(`\nキーワード：${keywords.map((k) => `「${k}」`).join(" ")}`);
  if (books.size) lines.push(`\n関連する本：\n${[...books.values()].slice(0, 10).map((t) => `- 『${t}』`).join("\n")}`);
  if (quotes.size) lines.push(`\n関連するフレーズ：\n${[...quotes.values()].slice(0, 6).map((t) => `- ${quoted(clip(t, 60))}`).join("\n")}`);
  if (knowledge.size) lines.push(`\n関連する知識：\n${[...knowledge.values()].slice(0, 6).map((t) => `- ${t}`).join("\n")}`);
  if (refs.size) lines.push(`\n関連する創作データ：\n${[...refs.values()].slice(0, 10).map((r) => `- ${r.label}`).join("\n")}`);
  if (!books.size && !quotes.size && !knowledge.size && !refs.size) lines.push("\n該当するデータは見つかりませんでした。作品に参考資料を関連付けるか、別のキーワードでお試しください。");
  return {
    answer: lines.join("\n"),
    sources: {
      books: [...books].slice(0, 20).map(([id, title]) => ({ id, title })),
      quotes: [...quotes].slice(0, 20).map(([id, text]) => ({ id, text })),
      knowledge: [...knowledge].slice(0, 20).map(([id, title]) => ({ id, title })),
      creative: [...refs.values()].slice(0, 20),
    } satisfies EditorSources,
    proposals: [] as Proposal[],
  };
}

/* ---------------- 相談する ---------------- */

export async function askEditor(db: Db, projectId: string, conversationId: string | null, question: string, ctx: EditorContext = {}) {
  const q = question.trim();
  if (!q) throw new AppError("相談内容を入力してください", "VALIDATION");
  if (q.length > 3000) throw new AppError("3000文字以内で入力してください", "VALIDATION");
  const { project, text: contextText, focus } = await buildContext(db, projectId, ctx);

  let conv = conversationId ? await db.aIConversation.findFirst({ where: { id: conversationId, projectId }, include: { messages: { orderBy: { createdAt: "asc" } } } }) : null;
  if (conversationId && !conv) throw new NotFoundError("相談");
  if (!conv) conv = { ...(await db.aIConversation.create({ data: { title: q.slice(0, 40), projectId } })), messages: [] };
  await db.aIMessage.create({ data: { conversationId: conv.id, role: "user", content: q } });

  const avail = await aiAvailable(db);
  let result: { answer: string; sources: EditorSources; proposals: Proposal[] };
  let mode: "ai" | "local" = "local";
  if (avail.ok) {
    try {
      const sources = newSources();
      const refs: CreativeRefs = new Map(focus.map((f) => [`${f.kind}:${f.id}`, f]));
      const tools = [...(ctx.includeNotes !== false ? CREATIVE_TOOLS : CREATIVE_TOOLS.filter((t) => t.name !== "search_creative" && t.name !== "find_similar_notes")), ...(ctx.includeReading !== false ? LIBRARIAN_TOOLS : [])];
      const history: ChatTurn[] = conv.messages.slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      history.push({ role: "user", content: q });
      const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
      const text = await getProvider().chat({
        system: `${SYSTEM.replace("{today}", today)}\n\n${contextText}`,
        messages: history,
        tools,
        maxSteps: 8,
        runTool: (name, input) =>
          LIBRARIAN_TOOLS.some((t) => t.name === name) ? runLibrarianTool(db, name, input, sources) : runCreativeTool(db, name, input, projectId, refs, sources),
      });
      const parsed = parseOutput(text, sources.books, sources.quotes, sources.knowledge, refs);
      result = { answer: parsed.answer, sources: parsed.sources, proposals: await validateProposals(db, projectId, parsed.proposals) };
      mode = "ai";
    } catch (e) {
      result = await localEditorAnswer(db, projectId, q, ctx, `${aiErrorMessage(e)}\n代わりに、`);
    }
  } else {
    result = await localEditorAnswer(db, projectId, q, ctx, avail.reason);
  }

  const msg = await db.aIMessage.create({
    data: { conversationId: conv.id, role: "assistant", content: result.answer, sources: JSON.stringify({ ...result.sources, proposals: result.proposals, mode }) },
  });
  await db.aIConversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } });
  return { conversationId: conv.id, projectTitle: project.title, message: { id: msg.id, role: "assistant" as const, content: result.answer, sources: result.sources, proposals: result.proposals, mode } };
}

/* ---------------- 提案の採用（ユーザーが選んだときだけ保存） ---------------- */

const NOT_NULL_FIELDS = new Set(["world.content"]);

export async function applyProposal(db: Db, projectId: string, proposal: Proposal) {
  if (proposal.type === "create_note") {
    const { createCreativeNote, createLink } = await import("@/server/services/creative");
    const note = await createCreativeNote(db, { title: proposal.title, content: proposal.content, category: (CREATIVE_CATEGORIES as readonly string[]).includes(proposal.category) ? (proposal.category as never) : "OTHER" });
    await createLink(db, { source: { kind: "note", id: note.id }, target: { kind: "project", id: projectId } });
    return { kind: "note" as const, id: note.id };
  }
  const { target, id, field } = proposal;
  if (!(target in UPDATABLE_FIELDS) || !(field in UPDATABLE_FIELDS[target])) throw new AppError("この項目は変更できません", "VALIDATION");
  if (!(await targetLabel(db, projectId, target, id))) throw new NotFoundError("対象のデータ");
  const raw = String(proposal.value ?? "").slice(0, 20000);
  const value = NOT_NULL_FIELDS.has(`${target}.${field}`) ? raw : raw.trim() ? raw : null;
  const data = { [field]: value };
  switch (target) {
    case "project":
      await db.novelProject.update({ where: { id }, data });
      break;
    case "character":
      await db.character.update({ where: { id }, data });
      break;
    case "world":
      await db.worldSetting.update({ where: { id }, data });
      break;
    case "plot":
      await db.plot.update({ where: { id }, data });
      break;
    case "chapter":
      await db.chapter.update({ where: { id }, data });
      break;
    case "scene":
      await db.scene.update({ where: { id }, data });
      break;
  }
  return { kind: target, id };
}
