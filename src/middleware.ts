import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// 安価な関門: Cookieの有無だけを見る（edgeなのでDBは呼ばない）。
// 本物の検証（有効期限・操作者の有効性）は各ルート/ページの getCurrentActor が行う。
// 公開パス:
//  - /login（ログイン画面）
//  - /api/auth/login, /api/auth/logout（未ログインでも叩ける）
//  - /api/mail/fetch（人間セッションでなく WORKER_TOKEN で保護＝ルート側で検証）
const PUBLIC_PATHS = [/^\/login$/, /^\/api\/auth\/login$/, /^\/api\/auth\/logout$/, /^\/api\/mail\/fetch$/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((re) => re.test(pathname))) {
    return NextResponse.next();
  }
  if (req.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // 静的アセットとfaviconは対象外。それ以外の全ルートに適用。
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
