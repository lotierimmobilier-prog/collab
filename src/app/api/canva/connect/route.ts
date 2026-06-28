import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canvaConfigured, createPkce, buildAuthorizeUrl } from "@/lib/canva";

// GET /api/canva/connect — démarre la connexion OAuth Canva (redirection).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canvaConfigured()) return NextResponse.json({ error: "Canva non configuré (variables d'environnement manquantes)." }, { status: 503 });

  const { challenge } = await createPkce(session.user.id);
  // state = identifiant utilisateur (vérifié au retour contre la session).
  const url = buildAuthorizeUrl(challenge, session.user.id);
  return NextResponse.redirect(url);
}
