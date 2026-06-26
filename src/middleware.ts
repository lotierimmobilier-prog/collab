import { NextRequest, NextResponse } from "next/server";

// ── Routes publiques (pas d'auth requise) ────────────────────────
const PUBLIC_PATHS = [
  "/api/auth",
  "/api/public",       // endpoints publics (assistance locataire par lien)
  "/login",
  "/candidature",
  "/declaration",      // page publique d'assistance locataire (/declaration/<token>)
  "/_next",
  "/logo.png",
  "/favicon.ico",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p));
}

// ── Rate limiting in-memory (Edge compatible) ────────────────────
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_MAX    = 10;
const LOGIN_WINDOW = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= LOGIN_MAX;
}

// ── Middleware principal ─────────────────────────────────────────
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Rate limiting sur l'authentification (10 req/min par IP)
  if (pathname.startsWith("/api/auth") || pathname === "/login") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    if (!checkRateLimit(ip)) {
      return new NextResponse("Trop de tentatives — réessayez dans 1 minute", {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": "60",
        },
      });
    }
  }

  // 3. Routes publiques → passer sans vérif session
  if (isPublic(pathname)) {
    return withSecurityHeaders(NextResponse.next(), req);
  }

  // 4. Vérification session NextAuth v5
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("next-auth.session-token")?.value;

  if (!sessionToken) {
    // Routes API → JSON 401 (pas de redirect HTML)
    if (pathname.startsWith("/api/")) {
      return new NextResponse(JSON.stringify({ error: "Non authentifié" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", encodeURIComponent(pathname));
    return NextResponse.redirect(loginUrl);
  }

  return withSecurityHeaders(NextResponse.next(), req);
}

// ── En-têtes de sécurité additionnels au niveau middleware ───────
function withSecurityHeaders(res: NextResponse, req: NextRequest): NextResponse {
  // Pages privées : pas de cache navigateur/CDN
  if (!req.nextUrl.pathname.startsWith("/_next/static")) {
    res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  }
  // COOP : autoriser les popups OAuth (Google, etc.)
  // COEP désactivé — trop restrictif pour ressources Google/CDN externes
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
};
