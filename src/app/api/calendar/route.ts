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

  // Chevauchement de la fenêtre [from, to] : un événement est inclus dès qu'il
  // recoupe la période (début ≤ to ET fin ≥ from). Évite d'exclure ceux qui
  // débordent la semaine (journées entières, multi-jours).
  const all = await prisma.calendarEvent.findMany({
    where: {
      ...(to   && { start: { lte: new Date(to)   } }),
      ...(from && { end:   { gte: new Date(from) } }),
    },
    orderBy: { start: "asc" },
  });

  // Cloisonnement : chacun ne voit que les événements qu'il a créés ou auxquels
  // il participe ; admin voit tout.
  const isAdmin = session.user.roleId === "admin";
  const uid = session.user.id;
  const myEmail = (session.user.email || "").toLowerCase();
  const events = isAdmin ? all : all.filter(e => {
    if (e.createdBy === uid) return true;
    const att = Array.isArray(e.attendees) ? (e.attendees as Array<{ type?: string; id?: string; email?: string }>) : [];
    return att.some(a => (a.type === "user" && a.id === uid) || (!!a.email && a.email.toLowerCase() === myEmail));
  });

  const internal = events.map(e => ({
    ...e,
    start: e.start.toISOString(),
    end:   e.end.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }));

  // Fusion de l'agenda Google connecté (permanent, côté serveur) sur la même
  // fenêtre → le planning ET le tableau de bord l'affichent sans reconnexion.
  let google: unknown[] = [];
  try {
    const { getGoogleEvents } = await import("@/lib/googleCalendarServer");
    const gMin = from ? new Date(from).toISOString() : new Date(Date.now() - 60 * 86400_000).toISOString();
    const gMax = to   ? new Date(to).toISOString()   : new Date(Date.now() + 180 * 86400_000).toISOString();
    const evs = await getGoogleEvents(uid, gMin, gMax);
    google = evs.map(e => ({
      id: e.id, title: e.title, start: e.start, end: e.end, color: e.color,
      description: e.description ?? null, location: e.location ?? null,
      type: "google", source: "google", htmlLink: e.htmlLink ?? null,
      allDay: !e.start.includes("T"), attendees: null, createdBy: uid,
    }));
  } catch { /* Google non configuré / non connecté → ignore */ }

  return NextResponse.json([...internal, ...google]);
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
