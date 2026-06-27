import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/google/calendar/disconnect — supprime la connexion Google Agenda.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.googleCalendarAccount.delete as any)({ where: { userId: session.user.id } }).catch(() => {});
  } catch { /* déjà absent */ }
  return NextResponse.json({ ok: true });
}
