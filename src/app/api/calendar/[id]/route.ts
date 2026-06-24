import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendMail } from "@/lib/mailer";

interface Attendee { type: "user" | "contact"; id?: string; name: string; email: string; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
}

function changeMailHtml(title: string, changes: string[], start: string, end: string, location?: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden"><div style="background:#B8966A;padding:20px 24px"><h1 style="color:#fff;margin:0;font-size:20px">📅 Événement modifié : ${title}</h1></div><div style="padding:24px"><p style="color:#374151;font-weight:600">Modifications apportées :</p><ul style="color:#374151;padding-left:20px">${changes.map(c => `<li>${c}</li>`).join("")}</ul><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"><p style="color:#374151"><strong>Début :</strong> ${fmtDate(start)}</p><p style="color:#374151"><strong>Fin :</strong> ${fmtDate(end)}</p>${location ? `<p style="color:#374151"><strong>Lieu :</strong> ${location}</p>` : ""}<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"><p style="color:#9ca3af;font-size:12px">Collab — Lotier Immobilier · <a href="https://collab.lotier-immobilier.com/planning">Voir l'agenda</a></p></div></div>`;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const old = await prisma.calendarEvent.findUnique({ where: { id } });

  const event = await prisma.calendarEvent.update({
    where: { id },
    data: {
      ...(body.title       !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.location    !== undefined && { location: body.location }),
      ...(body.start       !== undefined && { start: new Date(body.start) }),
      ...(body.end         !== undefined && { end: new Date(body.end) }),
      ...(body.allDay      !== undefined && { allDay: body.allDay }),
      ...(body.color       !== undefined && { color: body.color }),
      ...(body.type        !== undefined && { type: body.type }),
      ...(body.attendees   !== undefined && { attendees: body.attendees }),
    },
  });

  const changes: string[] = [];
  if (old) {
    if (body.title !== undefined && body.title !== old.title) changes.push(`Titre : "${old.title}" → "${body.title}"`);
    if (body.start !== undefined && new Date(body.start).getTime() !== old.start.getTime()) changes.push(`Début : ${fmtDate(old.start.toISOString())} → ${fmtDate(body.start)}`);
    if (body.end !== undefined && new Date(body.end).getTime() !== old.end.getTime()) changes.push(`Fin : ${fmtDate(old.end.toISOString())} → ${fmtDate(body.end)}`);
    if (body.location !== undefined && body.location !== old.location) changes.push(`Lieu : ${old.location ?? "(aucun)"} → ${body.location ?? "(aucun)"}`);
    if (body.description !== undefined && body.description !== old.description) changes.push("Description modifiée");
  }

  if (changes.length > 0 && body.attendees) {
    const attendees = body.attendees as Attendee[];
    const html = changeMailHtml(event.title, changes, event.start.toISOString(), event.end.toISOString(), event.location ?? undefined);
    for (const a of attendees) {
      if (a.email) sendMail({ to: a.email, subject: `[Collab] Événement modifié : ${event.title}`, html }).catch(() => {});
    }
    const userIds = attendees.filter(a => a.type === "user" && a.id).map(a => a.id!);
    if (userIds.length > 0) {
      await prisma.notification.createMany({
        data: userIds.map(uid => ({
          userId: uid,
          type: "calendar",
          title: "Événement modifié",
          body: `${event.title} — ${changes[0]}`,
          link: "/planning",
        })),
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json({ ...event, start: event.start.toISOString(), end: event.end.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.calendarEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
