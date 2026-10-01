import "server-only";
/**
 * AI プロバイダの抽象化。
 * Anthropic（Claude）と OpenAI（ChatGPT）を実装。AI_PROVIDER で切り替える。
 * 別プロバイダを追加する場合は AiProvider を実装して getProvider に登録する。
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { aiConfig } from "./config";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AiToolDef {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[]; additionalProperties?: boolean };
}

export interface AiProvider {
  name: string;
  /** ツールを使いながら回答する（ツールはアプリ側で実行） */
  chat(opts: { system: string; messages: ChatTurn[]; tools: AiToolDef[]; runTool: (name: string, input: unknown) => Promise<string>; maxSteps?: number }): Promise<string>;
  /** JSON スキーマに沿った構造化出力 */
  json<T>(opts: { system: string; prompt: string; schema: Record<string, unknown> }): Promise<T>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI provider is not configured");
  }
}

class AnthropicProvider implements AiProvider {
  name = "anthropic";
  private client: Anthropic;
  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  /** Claude Opus 5 / Fable 系は拒否時にサーバー側で別モデルへフォールバックさせる */
  private fallbackParams() {
    return /^claude-(opus-5|fable-5)/.test(this.model)
      ? { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const }
      : {};
  }

  async chat({ system, messages, tools, runTool, maxSteps = 6 }: Parameters<AiProvider["chat"]>[0]) {
    const history: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
    for (let step = 0; step < maxSteps; step++) {
      const res = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: tools as Anthropic.Beta.BetaTool[],
        messages: history,
        ...this.fallbackParams(),
      });
      if (res.stop_reason === "refusal") return "申し訳ありません。この質問にはお答えできませんでした。表現を変えてお試しください。";
      // フォールバック・思考ブロックを含めて履歴にそのまま戻す
      history.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
      const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || !toolUses.length) {
        return res.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
      }
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
        toolUses.map(async (t) => {
          try {
            return { type: "tool_result" as const, tool_use_id: t.id, content: await runTool(t.name, t.input) };
          } catch (e) {
            return { type: "tool_result" as const, tool_use_id: t.id, content: `エラー: ${(e as Error).message}`, is_error: true };
          }
        }),
      );
      history.push({ role: "user", content: results });
    }
    return "調べる範囲が広すぎたため、回答をまとめきれませんでした。質問を絞ってもう一度お試しください。";
  }

  async json<T>({ system, prompt, schema }: Parameters<AiProvider["json"]>[0]): Promise<T> {
    const res = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema } },
      ...this.fallbackParams(),
    });
    if (res.stop_reason === "refusal") throw new Error("refusal");
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return JSON.parse(text) as T;
  }
}

/** OpenAI（ChatGPT）。GPT-6 系はツール併用に Responses API が必要なので、そちらを使う */
class OpenAiProvider implements AiProvider {
  name = "openai";
  private client: OpenAI;
  constructor(
    apiKey: string,
    private model: string,
  ) {
    this.client = new OpenAI({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async chat({ system, messages, tools, runTool, maxSteps = 6 }: Parameters<AiProvider["chat"]>[0]) {
    // store: false でOpenAI側に会話を保存しない。推論内容は暗号化された形で受け取り、次の呼び出しに渡し直す
    const input: OpenAI.Responses.ResponseInputItem[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const fnTools: OpenAI.Responses.FunctionTool[] = tools.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.input_schema, strict: false }));
    for (let step = 0; step < maxSteps; step++) {
      const res = await this.client.responses.create({
        model: this.model,
        instructions: system,
        input,
        tools: fnTools.length ? fnTools : undefined,
        max_output_tokens: 16000,
        store: false,
        include: ["reasoning.encrypted_content"],
      });
      const calls = res.output.filter((o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === "function_call");
      if (!calls.length) {
        const refused = res.output.some((o) => o.type === "message" && o.content.some((c) => c.type === "refusal"));
        if (refused) return "申し訳ありません。この質問にはお答えできませんでした。表現を変えてお試しください。";
        return res.output_text.trim();
      }
      input.push(...(res.output as OpenAI.Responses.ResponseInputItem[]));
      for (const c of calls) {
        let output: string;
        try {
          output = await runTool(c.name, JSON.parse(c.arguments || "{}"));
        } catch (e) {
          output = `エラー: ${(e as Error).message}`;
        }
        input.push({ type: "function_call_output", call_id: c.call_id, output });
      }
    }
    return "調べる範囲が広すぎたため、回答をまとめきれませんでした。質問を絞ってもう一度お試しください。";
  }

  async json<T>({ system, prompt, schema }: Parameters<AiProvider["json"]>[0]): Promise<T> {
    const res = await this.client.responses.create({
      model: this.model,
      instructions: system,
      input: prompt,
      max_output_tokens: 16000,
      store: false,
      text: { format: { type: "json_schema", name: "result", schema, strict: false } },
    });
    if (res.output.some((o) => o.type === "message" && o.content.some((c) => c.type === "refusal"))) throw new Error("refusal");
    return JSON.parse(res.output_text) as T;
  }
}

export function getProvider(): AiProvider {
  const cfg = aiConfig();
  if (!cfg.configured) throw new AiNotConfiguredError();
  const key = process.env.AI_API_KEY!.trim();
  return cfg.provider === "openai" ? new OpenAiProvider(key, cfg.model) : new AnthropicProvider(key, cfg.model);
}

/** AI エラーをユーザー向けメッセージに変換（技術的な詳細は出さない） */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof AiNotConfiguredError) return "AI機能が設定されていません。設定画面をご確認ください。";
  if (e instanceof OpenAI.AuthenticationError || e instanceof Anthropic.AuthenticationError) return "AIのAPIキーが正しくないようです。.env の AI_API_KEY を確認してください。";
  if (e instanceof OpenAI.NotFoundError) return "指定したAIモデルが見つかりません。.env の AI_MODEL（例: gpt-6-luna）を確認してください。";
  if (e instanceof OpenAI.RateLimitError || e instanceof Anthropic.RateLimitError) return "AIの利用が混み合っています。しばらく待ってから再度お試しください。";
  if (e instanceof OpenAI.APIConnectionError || e instanceof Anthropic.APIConnectionError) return "AIサービスに接続できませんでした。ネットワーク接続を確認してください。";
  if (e instanceof OpenAI.APIError || e instanceof Anthropic.APIError) return "AIサービスでエラーが発生しました。時間をおいて再度お試しください。";
  console.error("[ai]", e);
  return "AIの処理中に問題が発生しました。時間をおいて再度お試しください。";
}
