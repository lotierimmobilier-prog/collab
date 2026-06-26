import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";

export const runtime = "nodejs";

const MAX_TOTAL_BYTES = 40 * 1024 * 1024; // 40 Mo cumulés par compte rendu (audio inclus)

interface MeetingDoc { id: string; name: string; mime: string; kind: "pdf" | "audio"; size: number; data: string }

async function guard() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isDirection(session.user.roleId)) return { err: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  return { session };
}

function sanitizeDocs(input: unknown): { docs: MeetingDoc[]; error?: string } {
  const arr = Array.isArray(input) ? input : [];
  const docs: MeetingDoc[] = [];
  let total = 0;
  for (const d of arr as MeetingDoc[]) {
    if (!d || typeof d.data !== "string") continue;
    const kind: "pdf" | "audio" = d.kind === "audio" ? "audio" : "pdf";
    const size = Number(d.size) || Math.round(d.data.length * 0.75);
    total += size;
    docs.push({ id: String(d.id || Math.random().toString(36).slice(2)), name: String(d.name || "document"), mime: String(d.mime || ""), kind, size, data: d.data });
  }
  if (total > MAX_TOTAL_BYTES) return { docs, error: "Pièces jointes trop volumineuses (max 40 Mo au total)." };
  return { docs };
}

/** Allège un compte rendu : enlève les données binaires, ne garde que les métadonnées des pièces. */
function lite(m: { documents: unknown } & Record<string, unknown>) {
  const docs = (Array.isArray(m.documents) ? m.documents : []) as MeetingDoc[];
  return { ...m, documents: docs.map(d => ({ id: d.id, name: d.name, mime: d.mime, kind: d.kind, size: d.size })) };
}

/** GET — liste (sans données binaires) ou ?id= (compte rendu complet avec pièces). */
export async function GET(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const m = await prisma.directionMeeting.findUnique({ where: { id } });
    if (!m) return NextResponse.json({ error: "Compte rendu introuvable" }, { status: 404 });
    return NextResponse.json({ meeting: m });
  }
  const items = await prisma.directionMeeting.findMany({ orderBy: { date: "desc" } });
  return NextResponse.json({ items: items.map(lite) });
}

/** POST — crée un compte rendu. */
export async function POST(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const body = await req.json().catch(() => ({}));
  if (!body.date) return NextResponse.json({ error: "Date requise" }, { status: 400 });
  const { docs, error } = sanitizeDocs(body.documents);
  if (error) return NextResponse.json({ error }, { status: 413 });

  const meeting = await prisma.directionMeeting.create({
    data: {
      title: String(body.title || "Réunion de direction").trim() || "Réunion de direction",
      date: new Date(body.date),
      participants: body.participants ? String(body.participants).trim() : null,
      summary: body.summary ? String(body.summary).trim() : null,
      documents: docs as unknown as Prisma.InputJsonValue,
      createdById: g.session.user.id ?? null,
    },
  });
  return NextResponse.json({ meeting: lite(meeting) });
}

/** PATCH — met à jour un compte rendu (champs et/ou pièces jointes). */
export async function PATCH(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = String(body.title).trim() || "Réunion de direction";
  if (body.date !== undefined) data.date = new Date(body.date);
  if (body.participants !== undefined) data.participants = body.participants ? String(body.participants).trim() : null;
  if (body.summary !== undefined) data.summary = body.summary ? String(body.summary).trim() : null;
  if (body.documents !== undefined) {
    const { docs, error } = sanitizeDocs(body.documents);
    if (error) return NextResponse.json({ error }, { status: 413 });
    data.documents = docs as unknown as Prisma.InputJsonValue;
  }

  const meeting = await prisma.directionMeeting.update({ where: { id: body.id }, data });
  return NextResponse.json({ meeting: lite(meeting) });
}

/** DELETE ?id= — supprime un compte rendu. */
export async function DELETE(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await prisma.directionMeeting.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
