"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, SESSION_DAYS, authEnabled, checkPassword, createSessionToken } from "@/lib/auth";

export async function loginAction(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  if (!authEnabled()) redirect("/");
  const password = String(form.get("password") ?? "").slice(0, 200);
  const next = String(form.get("next") ?? "/");
  if (!(await checkPassword(password))) {
    // 総当たり対策として失敗時は少し待つ
    await new Promise((r) => setTimeout(r, 800));
    return { error: "パスワードが違います" };
  }
  const jar = await cookies();
  jar.set(AUTH_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  // 外部サイトへのリダイレクトを防ぐ
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}
