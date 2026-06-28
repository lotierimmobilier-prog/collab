import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeCode } from "@/lib/canva";

// GET /api/canva/callback — retour OAuth Canva : échange le code puis renvoie
// vers la page Réseaux sociaux.
export async function GET(req: NextRequest) {
  const session = await auth();
  const url = new URL(req.url);
  const back = new URL("/reseaux-sociaux", url.origin);
  if (!session?.user?.id) return NextResponse.redirect(new URL("/", url.origin));

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
