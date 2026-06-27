import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGoogleEvents } from "@/lib/googleCalendarServer";

// GET /api/google/calendar/events?from=ISO&to=ISO — événements Google de
// l'utilisateur (agendas sélectionnés). Renvoie [] si non connecté.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const now = Date.now();
  const from = searchParams.get("from") || new Date(now - 30 * 86400_000).toISOString();
  const to = searchParams.get("to") || new Date(now + 120 * 86400_000).toISOString();
  const events = await getGoogleEvents(session.user.id, from, to).catch(() => []);
  return NextResponse.json(events);
}
