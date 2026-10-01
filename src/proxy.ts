import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authEnabled, verifySessionToken } from "@/lib/auth";

/** ログインしていない場合はログイン画面へ（APP_PASSWORD 設定時のみ） */
export async function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();
  const ok = await verifySessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (ok) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "ログインが必要です" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // ログイン画面・PWA の静的ファイルは認証なしで取得できるようにする
  matcher: ["/((?!_next/static|_next/image|login|offline|icons/|icon.png|favicon|manifest.webmanifest|sw.js).*)"],
};
