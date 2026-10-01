/** ユーザーに表示してよいメッセージを持つエラー */
export class AppError extends Error {
  constructor(
    public userMessage: string,
    public code: string = "APP_ERROR",
    public meta?: Record<string, unknown>,
  ) {
    super(userMessage);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(what = "データ") {
    super(`${what}が見つかりませんでした`, "NOT_FOUND");
  }
}

export class DuplicateError extends AppError {
  constructor(message: string, meta?: Record<string, unknown>) {
    super(message, "DUPLICATE", meta);
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; meta?: Record<string, unknown> };

/** 技術的なエラーを隠し、ユーザー向けメッセージに変換する */
export function toUserError(e: unknown): { ok: false; error: string; code?: string; meta?: Record<string, unknown> } {
  if (e instanceof AppError) return { ok: false, error: e.userMessage, code: e.code, meta: e.meta };
  if (e && typeof e === "object" && "name" in e && (e as { name: string }).name === "ZodError") {
    const issues = (e as unknown as { issues: { message: string }[] }).issues;
    return { ok: false, error: issues?.[0]?.message ?? "入力内容を確認してください", code: "VALIDATION" };
  }
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code: string }).code;
    if (code === "P2002") return { ok: false, error: "同じデータが既に登録されています", code: "DUPLICATE" };
    if (code === "P2025") return { ok: false, error: "データが見つかりませんでした", code: "NOT_FOUND" };
  }
  console.error("[BookNest] unexpected error:", e);
  return { ok: false, error: "保存中に問題が発生しました。時間をおいて再度お試しください。", code: "INTERNAL" };
}
