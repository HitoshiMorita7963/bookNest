import "server-only";
/**
 * AI 執筆アシスト：執筆画面で、続きの案と、選んだ文の書き直し案を出す。
 * 案は本文に直接書き込まず返すだけで、ユーザーが「挿入」したものだけが本文になる。
 * AI には、このシーンの本文に加えて、作品・章・シーンの概要、登場人物、前のシーンの終わりを渡す。
 */
import type { Db } from "@/lib/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { getProvider } from "./provider";

export const CONTINUE_LENGTHS = { short: 200, medium: 500, long: 1000 } as const;
export type ContinueLength = keyof typeof CONTINUE_LENGTHS;

export const REWRITE_MODES = {
  describe: "情景や五感の描写を足して、場面が目に浮かぶようにする",
  dialogue: "会話（「」のセリフ）を増やして、人物のやりとりで場面を進める",
  shorter: "意味を変えずに短く、引き締まった文にする",
  tension: "緊張感・切迫感を高める",
  softer: "やわらかく、温かみのある文にする",
  free: "指示に従って書き直す",
} as const;
export type RewriteMode = keyof typeof REWRITE_MODES;

/** AI に渡す本文の範囲（長すぎると遅く・高くなるため、カーソルの前後だけを渡す） */
const BEFORE_CHARS = 4000;
const AFTER_CHARS = 800;
const PREV_SCENE_CHARS = 800;
const MAX_CHARACTERS = 20;

export interface WriterContext {
  project: { title: string; logline: string | null; synopsis: string | null; genre: string | null; theme: string | null };
  chapter: { title: string; summary: string | null };
  scene: { title: string; summary: string | null };
  characters: { name: string; role: string | null; personality: string | null; speechStyle: string | null; goal: string | null }[];
  prevSceneTail: string | null;
}

export async function writerContext(db: Db, sceneId: string): Promise<WriterContext> {
  const s = await db.scene.findUnique({
    where: { id: sceneId },
    select: {
      id: true,
      title: true,
      summary: true,
      chapter: {
        select: {
          id: true,
          title: true,
          summary: true,
          project: {
            select: {
              id: true,
              title: true,
              logline: true,
              synopsis: true,
              genre: true,
              theme: true,
              characters: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], take: MAX_CHARACTERS, select: { name: true, role: true, personality: true, speechStyle: true, goal: true } },
            },
          },
        },
      },
    },
  });
  if (!s) throw new NotFoundError("シーン");
  const p = s.chapter.project;
  // 前のシーン（章をまたぐ）の終わり：話のつながりを保つため
  const order = await db.chapter.findMany({
    where: { projectId: p.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { scenes: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, content: true } } },
  });
  const flat = order.flatMap((c) => c.scenes);
  const i = flat.findIndex((x) => x.id === s.id);
  const prev = i > 0 ? flat[i - 1].content?.trimEnd() : null;
  return {
    project: { title: p.title, logline: p.logline, synopsis: p.synopsis, genre: p.genre, theme: p.theme },
    chapter: { title: s.chapter.title, summary: s.chapter.summary },
    scene: { title: s.title, summary: s.summary },
    characters: p.characters,
    prevSceneTail: prev ? prev.slice(-PREV_SCENE_CHARS) : null,
  };
}

const line = (label: string, v: string | null | undefined) => (v?.trim() ? `${label}：${v.trim()}\n` : "");

/** 作品の設定（AI への説明部分） */
export function describeContext(ctx: WriterContext): string {
  const chars = ctx.characters
    .map((c) => `- ${c.name}${c.role ? `（${c.role}）` : ""}${[c.personality && `性格：${c.personality}`, c.speechStyle && `口調：${c.speechStyle}`, c.goal && `目的：${c.goal}`].filter(Boolean).map((x) => ` ${x}`).join("")}`)
    .join("\n");
  return (
    `作品：『${ctx.project.title}』\n` +
    line("一行あらすじ", ctx.project.logline) +
    line("作品概要", ctx.project.synopsis) +
    line("ジャンル", ctx.project.genre) +
    line("テーマ", ctx.project.theme) +
    `章：${ctx.chapter.title}\n` +
    line("章の概要", ctx.chapter.summary) +
    `シーン：${ctx.scene.title}\n` +
    line("シーンの概要", ctx.scene.summary) +
    (chars ? `登場人物：\n${chars}\n` : "") +
    (ctx.prevSceneTail ? `\n--- 前のシーンの終わり ---\n${ctx.prevSceneTail}\n--- ここまで ---\n` : "")
  );
}

const SYSTEM = `あなたは日本語の小説の執筆を手伝うアシスタントです。作者の文章の続きや書き直しの「案」を書きます。
- 作者の文体（一人称・三人称、です・ます調かどうか、文の長さ、改行の仕方）と、人物の口調に合わせる。
- 段落の頭は全角スペース1つで字下げし、会話は「」で書く。地の文とセリフは改行で分ける。
- ルビは |漢字《かんじ》、傍点は 《《強調》》 の記法。作者が使っていれば同じように使ってよい。
- 見出し・番号・Markdown・説明・前置きは書かない。本文だけを text に入れる。
- 登場人物の設定や、すでに書かれた出来事と矛盾させない。`;

const SCHEMA = { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false };

/** AI の出力を本文に入れられる形に整える（前後の空行・コードブロックの記号を除く） */
export function cleanDraft(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/^```[a-z]*\n?|\n?```$/g, "")
    .replace(/^\n+/, "")
    .trimEnd();
}

export function continuePrompt(ctx: WriterContext, input: { before: string; after: string; length: ContinueLength; instruction?: string }) {
  const before = input.before.slice(-BEFORE_CHARS);
  const after = input.after.slice(0, AFTER_CHARS);
  return (
    describeContext(ctx) +
    `\n--- このシーンの本文（カーソルの前） ---\n${before || "（まだ何も書かれていません。シーンの書き出しから書いてください）"}\n--- カーソル位置 ---\n` +
    (after.trim() ? `--- カーソルの後ろにすでにある本文（ここにつながるように） ---\n${after}\n--- ここまで ---\n` : "") +
    `\nカーソル位置から続く本文を、約${CONTINUE_LENGTHS[input.length]}字で書いてください。` +
    (input.instruction?.trim() ? `\n作者からの指示：${input.instruction.trim()}` : "") +
    `\nカーソルの前の文章は繰り返さず、続きだけを書いてください。`
  );
}

export function rewritePrompt(ctx: WriterContext, input: { selected: string; before: string; after: string; mode: RewriteMode; instruction?: string }) {
  return (
    describeContext(ctx) +
    `\n--- 書き直す部分の前 ---\n${input.before.slice(-1500)}\n--- 書き直す部分 ---\n${input.selected}\n--- 書き直す部分の後ろ ---\n${input.after.slice(0, 500)}\n--- ここまで ---\n` +
    `\n「書き直す部分」だけを書き直してください。方針：${REWRITE_MODES[input.mode]}。` +
    (input.instruction?.trim() ? `\n作者からの指示：${input.instruction.trim()}` : "") +
    `\n前後の文章とつながるようにし、書き直した部分だけを text に入れてください。`
  );
}

export async function continueScene(db: Db, sceneId: string, input: { before: string; after: string; length: ContinueLength; instruction?: string }) {
  if (!(input.length in CONTINUE_LENGTHS)) throw new AppError("長さの指定が正しくありません", "VALIDATION");
  if ((input.instruction?.length ?? 0) > 500) throw new AppError("指示は500文字以内で入力してください", "VALIDATION");
  const ctx = await writerContext(db, sceneId);
  const res = await getProvider().json<{ text: string }>({ system: SYSTEM, prompt: continuePrompt(ctx, input), schema: SCHEMA });
  const text = cleanDraft(res.text ?? "");
  if (!text) throw new AppError("続きの案を作れませんでした。もう一度お試しください", "VALIDATION");
  return { text };
}

export async function rewriteSceneText(db: Db, sceneId: string, input: { selected: string; before: string; after: string; mode: RewriteMode; instruction?: string }) {
  if (!(input.mode in REWRITE_MODES)) throw new AppError("書き直しの方針が正しくありません", "VALIDATION");
  const selected = input.selected.trim();
  if (!selected) throw new AppError("書き直す文を選んでください", "VALIDATION");
  if (input.selected.length > 3000) throw new AppError("一度に書き直せるのは3000文字までです", "VALIDATION");
  if (input.mode === "free" && !input.instruction?.trim()) throw new AppError("どう書き直すかを入力してください", "VALIDATION");
  if ((input.instruction?.length ?? 0) > 500) throw new AppError("指示は500文字以内で入力してください", "VALIDATION");
  const ctx = await writerContext(db, sceneId);
  const res = await getProvider().json<{ text: string }>({ system: SYSTEM, prompt: rewritePrompt(ctx, input), schema: SCHEMA });
  const text = cleanDraft(res.text ?? "");
  if (!text) throw new AppError("書き直しの案を作れませんでした。もう一度お試しください", "VALIDATION");
  return { text };
}
