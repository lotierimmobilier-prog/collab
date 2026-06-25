import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";
import { MAX_VEHICLE_DOCS_BYTES, VehicleDoc } from "@/lib/vehicle";

async function guard() {
  const session = await auth();
  if (!session?.user) return { err: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isDirection(session.user.roleId)) return { err: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  return { session };
}

/** GET ?id= — fiche véhicule complète (documents, relevés, sinistres inclus). */
export async function GET(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) return NextResponse.json({ error: "Véhicule introuvable" }, { status: 404 });
  return NextResponse.json({ vehicle });
}

/** PATCH — met à jour les champs riches { documents, kmReadings, sinistres, currentKm }. */
export async function PATCH(req: NextRequest) {
  const g = await guard(); if (g.err) return g.err;
  const body = await req.json();
  const { id, documents, kmReadings, sinistres, currentKm } = body;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const data: Record<string, unknown> = {};

  if (documents !== undefined) {
    // Validation taille cumulée des documents
    const docs = Object.values(documents || {}).filter(Boolean) as VehicleDoc[];
    const total = docs.reduce((s, d) => s + (Number(d.size) || 0), 0);
    if (total > MAX_VEHICLE_DOCS_BYTES) return NextResponse.json({ error: "Documents trop volumineux (max 20 Mo au total)" }, { status: 413 });
    data.documents = documents as Prisma.InputJsonValue;
  }
  if (kmReadings !== undefined) {
    const readings = Array.isArray(kmReadings) ? kmReadings : [];
    data.kmReadings = readings as unknown as Prisma.InputJsonValue;
    // currentKm = relevé le plus récent
    const latest = [...readings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    if (latest?.km != null) data.currentKm = Number(latest.km);
  }
  if (sinistres !== undefined) data.sinistres = (Array.isArray(sinistres) ? sinistres : []) as unknown as Prisma.InputJsonValue;
  if (currentKm !== undefined && kmReadings === undefined) data.currentKm = currentKm == null || currentKm === "" ? null : Number(currentKm);

  const vehicle = await prisma.vehicle.update({ where: { id }, data });
  return NextResponse.json({ vehicle });
}
