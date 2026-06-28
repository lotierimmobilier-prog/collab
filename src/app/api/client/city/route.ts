import { NextRequest, NextResponse } from "next/server";
import { getClientFromCookie } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";

// GET — ville enregistrée par le locataire (pour la météo).
export async function GET() {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.$queryRawUnsafe(`SELECT city FROM client_prefs WHERE "tenantId" = $1 LIMIT 1`, client.id).catch(() => []);
  return NextResponse.json({ city: rows?.[0]?.city ?? null });
}

// POST { city } — enregistre la ville du locataire.
export async function POST(req: NextRequest) {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const city = typeof b?.city === "string" ? b.city.trim().slice(0, 120) : "";
  if (!city) return NextResponse.json({ error: "Ville requise." }, { status: 400 });
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO client_prefs ("tenantId", city, "updatedAt") VALUES ($1, $2, now())
         ON CONFLICT ("tenantId") DO UPDATE SET city = $2, "updatedAt" = now()`,
      client.id, city,
    );
    return NextResponse.json({ ok: true, city });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
