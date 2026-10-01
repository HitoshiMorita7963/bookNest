import "server-only";

export type AiProviderName = "anthropic" | "openai";

/** AI_PROVIDER の表記ゆれを吸収する（ChatGPT / OpenAI / Claude など） */
export function normalizeProvider(v: string | undefined, hasKey: boolean): AiProviderName | "none" {
  const p = (v ?? "").trim().toLowerCase().replace(/[\s_-]/g, "");
  if (!p) return hasKey ? "anthropic" : "none";
  if (["openai", "chatgpt", "gpt"].includes(p)) return "openai";
  if (["anthropic", "claude"].includes(p)) return "anthropic";
  return "none";
}

const DEFAULT_MODEL: Record<AiProviderName, string> = { anthropic: "claude-opus-5", openai: "gpt-6-luna" };

/** "GPT-6 Luna" のような表示名を API のモデルID（gpt-6-luna）に直す */
export function normalizeModel(v: string | undefined, provider: AiProviderName | "none"): string {
  const m = (v ?? "").trim();
  if (provider === "none") return m;
  if (!m) return DEFAULT_MODEL[provider];
  return provider === "openai" ? m.toLowerCase().replace(/\s+/g, "-") : m;
}

/** AI プロバイダ設定（APIキーは環境変数のみから読み込む） */
export function aiConfig() {
  const key = process.env.AI_API_KEY?.trim() || "";
  const provider = normalizeProvider(process.env.AI_PROVIDER, !!key);
  const configured = provider !== "none" && !!key;
  return {
    provider: configured ? provider : ("none" as const),
    providerLabel: provider === "openai" ? "OpenAI（ChatGPT）" : provider === "anthropic" ? "Anthropic（Claude）" : "未設定",
    model: normalizeModel(process.env.AI_MODEL, provider),
    configured,
  };
}
