import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendMail, eventMailHtml } from "@/lib/mailer";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const events = await prisma.calendarEvent.findMany({
    where: {
      ...(from && { start: { gte: new Date(from) } }),
      ...(to   && { end:   { lte: new Date(to)   } }),
    },
    orderBy: { start: "asc" },
  });

  return NextResponse.json(events.map(e => ({
    ...e,
    start: e.start.toISOString(),
    end:   e.end.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { title, description, location, start, end, allDay, color, type, attendees } = body;
  if (!title?.trim() || !start || !end) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const event = await prisma.calendarEvent.create({
    data: {
      title: title.trim(),
      description: description || null,
      location: location || null,
      start: new Date(start),
      end:   new Date(end),
      allDay: !!allDay,
      color: color ?? "#B8966A",
      type: type ?? "autre",
      createdBy: session.user.id,
      attendees: attendees ?? null,
    },
  });

  // Envoyer les invitations par mail aux participants
  const atts: { name: string; email: string }[] = Array.isArray(attendees) ? attendees : [];
  for (const att of atts) {
    if (!att.email) continue;
    try {
      await sendMail({
        to: att.email,
        subject: `Invitation : ${title.trim()}`,
        html: eventMailHtml({ title: title.trim(), start, end, location, description, attendees: atts }),
      });
    } catch { /* non bloquant */ }
  }

  // Notification aux utilisateurs mentionnés (type "user")
  const userAtts = atts.filter((a: { name: string; email: string } & { type?: string; id?: string }) => (a as { type?: string }).type === "user" && (a as { id?: string }).id);
  for (const att of userAtts as ({ id: string; name: string; email: string })[]) {
    await prisma.notification.create({
      data: {
        userId: att.id,
        type: "calendar",
        title: `Nouvel événement : ${title.trim()}`,
        body: new Date(start).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
        link: "/planning",
      },
    });
  }

  return NextResponse.json({ ...event, start: event.start.toISOString(), end: event.end.toISOString() }, { status: 201 });
}
