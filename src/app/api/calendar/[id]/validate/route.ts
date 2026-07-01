import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// POST /api/calendar/[id]/validate — l'utilisateur courant valide un créneau
// parrainage partagé. Confirmé quand le proposeur ET le binôme ont validé.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const uid = session.user.id;

  const ev = await prisma.calendarEvent.findUnique({ where: { id } }).catch(() => null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = ev as any;
  if (!ev || !e.parrainage) return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });

  // Seul un participant (le binôme) peut valider, et pas deux fois.
  const atts = Array.isArray(e.attendees) ? (e.attendees as Array<{ type?: string; id?: string }>) : [];
  const isParticipant = ev.createdBy === uid || atts.some(a => a.type === "user" && a.id === uid);
  if (!isParticipant) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const approved: string[] = Array.isArray(e.approvedBy) ? e.approvedBy.filter((x: unknown) => typeof x === "string") : [];
  if (!approved.includes(uid)) approved.push(uid);

  const updated = await prisma.calendarEvent.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { approvedBy: approved } as any,
  });

  // Prévenir le proposeur que son créneau vient d'être validé.
  if (ev.createdBy !== uid) {
    await prisma.notification.create({
      data: {
        userId: ev.createdBy,
        type: "calendar",
        title: `Créneau validé : ${ev.title}`,
        body: `${session.user.name || "Votre binôme"} a validé le créneau.`,
        link: "/planning",
      },
    }).catch(() => {});
  }

  return NextResponse.json({ ...updated, start: updated.start.toISOString(), end: updated.end.toISOString() });
}
