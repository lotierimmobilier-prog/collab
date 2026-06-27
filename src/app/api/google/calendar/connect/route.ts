import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { consentUrl, signState, googleConfigured } from "@/lib/googleCalendarServer";

// GET /api/google/calendar/connect — redirige vers le consentement Google
// (OAuth « offline »). Au retour, /callback enregistre le refresh_token.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!googleConfigured()) {
    return NextResponse.json({ error: "Google non configuré (GOOGLE_CLIENT_SECRET manquant). Contactez l'administrateur." }, { status: 503 });
  }
  const url = consentUrl(signState(session.user.id));
  return NextResponse.redirect(url);
}
