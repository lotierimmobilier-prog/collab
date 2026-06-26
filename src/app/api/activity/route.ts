import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { pageLabel, todayKey } from "@/lib/activity";

export const runtime = "nodejs";

/**
 * POST /api/activity — battement de présence (toutes les ~60 s) et journal de
 * navigation (nav=true au changement de page). Met à jour le temps passé.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const path = typeof body.path === "string" ? body.path.slice(0, 300) : "";
  const nav = body.nav === true;

  const userId = session.user.id;
  const userName = [session.user.prenom, session.user.nom].filter(Boolean).join(" ") || session.user.name || null;
  const day = todayKey();
  const now = new Date();

  // Présence : on additionne le temps écoulé depuis le dernier battement (borné).
  const existing = await prisma.userPresence.findUnique({ where: { userId_day: { userId, day } } });
  if (existing) {
    const delta = Math.min(120, Math.max(0, Math.floor((now.getTime() - existing.lastSeen.getTime()) / 1000)));
    await prisma.userPresence.update({ where: { id: existing.id }, data: { seconds: existing.seconds + delta, lastSeen: now, userName } });
  } else {
    await prisma.userPresence.create({ data: { userId, userName, day, seconds: 0, lastSeen: now } });
  }

  // Action de navigation (au changement de page seulement).
  if (nav && path) {
    await prisma.activityLog.create({ data: { userId, userName, kind: "action", label: pageLabel(path), path } });
  }

  return NextResponse.json({ ok: true });
}
