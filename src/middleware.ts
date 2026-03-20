import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 保护需要登录的路由（兼容 database session 策略）
export function middleware(req: NextRequest) {
  // next-auth 的 database session 会写 session token cookie
  const sessionToken =
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/dashboard", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // 仅保护以下路由，API routes 和静态资源不受影响
  matcher: ["/projects/:path*"],
};
