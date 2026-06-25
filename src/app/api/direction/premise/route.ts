import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";
import { MAX_PREMISE_DOCS_BYTES, PremiseDoc } from "@/lib/premise";

async function guard() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isDirection(session.user.roleId)) return { err: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  return { session };
}

/** GET ?id= — fiche locale complète. */
export async function GET(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const premise = await prisma.premise.findUnique({ where: { id } });
  if (!premise) return NextResponse.json({ error: "Local introuvable" }, { status: 404 });
  return NextResponse.json({ premise });
}

/** PATCH — met à jour les champs riches { documents, sinistres, controls, insurer }. */
export async function PATCH(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const { id, documents, sinistres, controls, insurer } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (documents !== undefined) {
    const docs = Array.isArray(documents) ? documents as PremiseDoc[] : [];
    const total = docs.reduce((s, d) => s + (Number(d.size) || 0), 0);
    if (total > MAX_PREMISE_DOCS_BYTES) return NextResponse.json({ error: "Documents trop volumineux (max 25 Mo au total)" }, { status: 413 });
    data.documents = docs as unknown as Prisma.InputJsonValue;
  }
  if (sinistres !== undefined) data.sinistres = (Array.isArray(sinistres) ? sinistres : []) as unknown as Prisma.InputJsonValue;
  if (controls !== undefined) data.controls = (Array.isArray(controls) ? controls : []) as unknown as Prisma.InputJsonValue;
  if (insurer !== undefined) data.insurer = insurer?.trim() || null;

  const premise = await prisma.premise.update({ where: { id }, data });
  return NextResponse.json({ premise });
}
