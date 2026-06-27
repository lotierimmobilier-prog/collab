import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStatus, googleConfigured } from "@/lib/googleCalendarServer";

// GET /api/google/calendar/status — état de la connexion Google Agenda.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const status = await getStatus(session.user.id);
  return NextResponse.json({ ...status, configured: googleConfigured() });
}
