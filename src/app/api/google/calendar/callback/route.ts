import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/lib/ics-crypto";
import { exchangeCode, fetchEmail, fetchCalendarList, verifyState, baseUrl } from "@/lib/googleCalendarServer";

// GET /api/google/calendar/callback — retour OAuth Google : échange le code,
// stocke le refresh_token chiffré et la liste des agendas, puis renvoie vers
// le planning.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const err = url.searchParams.get("error");
  // Redirige vers l'URL PUBLIQUE (NEXTAUTH_URL) et non l'origine interne du
  // conteneur (network_mode host → req.url = http://0.0.0.0:3000).
  const back = (p: string) => NextResponse.redirect(`${baseUrl()}/planning?gcal=${p}`);

  if (err) return back("refus");
  const userId = verifyState(state);
  if (!userId || !code) return back("invalide");

  try {
    const tok = await exchangeCode(code);
    if (!tok.refresh_token) {
      // Pas de refresh_token (consentement déjà donné sans « offline ») →
      // on demande à l'utilisateur de révoquer puis reconnecter.
      return back("sans_refresh");
    }
    const email = await fetchEmail(tok.access_token);
    let calendars: { id: string; summary: string; backgroundColor?: string; primary?: boolean }[] = [];
    try { calendars = await fetchCalendarList(tok.access_token); } catch { /* liste plus tard */ }
    // Par défaut : on affiche l'agenda principal.
    const selected = calendars.filter(c => c.primary).map(c => c.id);

    const data = {
      googleEmail: email,
      refreshToken: encryptSecret(tok.refresh_token),
      accessToken: encryptSecret(tok.access_token),
      accessExpiry: new Date(Date.now() + (tok.expires_in - 60) * 1000),
      selected,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      calendars: calendars as any,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.googleCalendarAccount.upsert as any)({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
    return back("connecte");
  } catch {
    return back("erreur");
  }
}
