import "server-only";

/** AI プロバイダ設定（APIキーは環境変数のみから読み込む） */
export function aiConfig() {
  const key = process.env.AI_API_KEY?.trim() || "";
  const provider = (process.env.AI_PROVIDER?.trim() || (key ? "anthropic" : "none")).toLowerCase();
  return {
    provider: provider === "anthropic" && key ? ("anthropic" as const) : ("none" as const),
    model: process.env.AI_MODEL?.trim() || "claude-opus-5",
    configured: provider === "anthropic" && !!key,
  };
}
