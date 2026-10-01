/**
 * かんたんなパスワードログイン（個人用）
 * - APP_PASSWORD が設定されている場合のみ有効（クラウド公開時に必須）。未設定なら認証なし（PC 内での利用）。
 * - セッションは「有効期限 + HMAC 署名」の Cookie。署名鍵は AUTH_SECRET（未設定なら APP_PASSWORD）。
 *   パスワードを変更すると既存のセッションはすべて無効になる。
 * - proxy（Edge/Node どちらでも動く）から使うため Web Crypto のみを使用する。
 */
export const AUTH_COOKIE = "bn_session";
export const SESSION_DAYS = 180;

export function authEnabled() {
  return !!process.env.APP_PASSWORD;
}

function secret() {
  return `${process.env.AUTH_SECRET || ""}:${process.env.APP_PASSWORD || ""}`;
}

const enc = new TextEncoder();

async function hmac(data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(now = Date.now()) {
  const exp = now + SESSION_DAYS * 86400000;
  return `${exp}.${await hmac(`booknest:${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined | null, now = Date.now()) {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now || !sig) return false;
  return safeEqual(sig, await hmac(`booknest:${exp}`));
}

/** パスワードの照合（長さに依存しない比較） */
export async function checkPassword(input: string) {
  const expected = process.env.APP_PASSWORD || "";
  if (!expected) return false;
  const [a, b] = await Promise.all([hmac(`pw:${input}`), hmac(`pw:${expected}`)]);
  return safeEqual(a, b);
}
