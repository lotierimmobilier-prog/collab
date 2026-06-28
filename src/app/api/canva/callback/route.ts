import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeCode } from "@/lib/canva";

// GET /api/canva/callback — retour OAuth Canva : échange le code puis renvoie
// vers la page Réseaux sociaux.
export async function GET(req: NextRequest) {
  const session = await auth();
  const url = new URL(req.url);
  // Derrière nginx, url.origin vaut l'adresse interne (http://0.0.0.0:3000).
  // On renvoie vers l'origine PUBLIQUE, déduite de l'URI de redirection Canva
  // (ou d'AUTH_URL/NEXTAUTH_URL), sinon on retombe sur l'origine de la requête.
  const publicOrigin = (() => {
    const src = process.env.CANVA_REDIRECT_URI || process.env.AUTH_URL || process.env.NEXTAUTH_URL;
    try { return src ? new URL(src).origin : url.origin; } catch { return url.origin; }
  })();
  const back = new URL("/reseaux-sociaux", publicOrigin);
  if (!session?.user?.id) return NextResponse.redirect(new URL("/", publicOrigin));

  const code  = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  // CSRF : le state doit correspondre à l'utilisateur connecté.
  if (!code || state !== session.user.id) {
    back.searchParams.set("canva", "error");
    return NextResponse.redirect(back);
  }
  const ok = await exchangeCode(session.user.id, code).catch(() => false);
  back.searchParams.set("canva", ok ? "connected" : "error");
  return NextResponse.redirect(back);
}
