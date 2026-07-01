import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendMail, eventMailHtml } from "@/lib/mailer";
import { getBinomes, proposerRole, colorForRole } from "@/lib/parrainage-binome";

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

  // Nom du proposeur pour les créneaux parrainage (affiché sur le planning).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parrainageEvents = events.filter(e => (e as any).parrainage);
  const proposerNames = new Map<string, string>();
  if (parrainageEvents.length) {
    const ids = [...new Set(parrainageEvents.map(e => e.createdBy))];
    const us = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, prenom: true, nom: true } }).catch(() => []);
    us.forEach(u => proposerNames.set(u.id, `${u.prenom} ${u.nom}`.trim()));
  }

  const internal = events.map(e => ({
    ...e,
    start: e.start.toISOString(),
    end:   e.end.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proposerName: (e as any).parrainage ? (proposerNames.get(e.createdBy) || null) : null,
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
  const { title, description, location, start, end, allDay, color, type, attendees, parrainage, binomeId } = body;
  if (!title?.trim() || !start || !end) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  // Planning parrainage : créneau partagé avec le binôme (parrain/filleul),
  // confirmé après validation des deux. Couleur selon le rôle du proposeur.
  let atts0: Array<{ type: string; id?: string; name: string; email: string }> = Array.isArray(attendees) ? attendees : [];
  let evColor = color ?? "#B8966A";
  let approvedBy: string[] | null = null;
  const isParrainage = !!parrainage && !!binomeId;
  if (isParrainage) {
    const binomes = await getBinomes(session.user.id);
    const binome = binomes.find(b => b.id === binomeId);
    if (binome) {
      evColor = colorForRole(proposerRole(binome.role));
      approvedBy = [session.user.id];
      // Le binôme est ajouté comme participant → il voit le créneau sur son planning.
      if (!atts0.some(a => a.type === "user" && a.id === binome.id)) {
        const u = await prisma.user.findUnique({ where: { id: binome.id }, select: { email: true } }).catch(() => null);
        atts0 = [...atts0, { type: "user", id: binome.id, name: binome.name, email: u?.email || "" }];
      }
    }
  }

  const event = await prisma.calendarEvent.create({
    data: {
      title: title.trim(),
      description: description || null,
      location: location || null,
      start: new Date(start),
      end:   new Date(end),
      allDay: !!allDay,
      color: evColor,
      type: type ?? "autre",
      createdBy: session.user.id,
      attendees: atts0.length ? atts0 : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(isParrainage && approvedBy ? { parrainage: true, approvedBy } as any : {}),
    },
  });

  // Envoyer les invitations par mail aux participants (binôme parrainage inclus).
  const atts = atts0 as ({ type?: string; id?: string; name: string; email: string })[];
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

  // Notification aux utilisateurs mentionnés (type "user"). Pour un créneau
  // parrainage, le binôme est invité à valider.
  const userAtts = atts.filter(a => a.type === "user" && a.id);
  for (const att of userAtts as ({ id: string; name: string; email: string })[]) {
    await prisma.notification.create({
      data: {
        userId: att.id,
        type: "calendar",
        title: isParrainage ? `Créneau à valider : ${title.trim()}` : `Nouvel événement : ${title.trim()}`,
        body: new Date(start).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
        link: "/planning",
      },
    });
  }

  return NextResponse.json({ ...event, start: event.start.toISOString(), end: event.end.toISOString() }, { status: 201 });
}
