import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/google/calendar/select — met à jour la liste des agendas affichés.
// body: { selected: string[] }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const selected: string[] = Array.isArray(body?.selected) ? body.selected.map(String) : [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.googleCalendarAccount.update as any)({ where: { userId: session.user.id }, data: { selected } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
