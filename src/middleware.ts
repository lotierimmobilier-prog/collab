import { NextRequest, NextResponse } from "next/server";

// Middleware Edge-compatible : vérifie juste la présence du cookie de session
// Sans importer next-auth (évite node:util/types en Edge runtime)
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Routes publiques — jamais protégées
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname.startsWith("/candidature") ||
    pathname.startsWith("/_next") ||
    pathname === "/logo.png" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // NextAuth v5 stocke la session dans ce cookie
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("next-auth.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
