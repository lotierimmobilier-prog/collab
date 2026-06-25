import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIcsGed } from "@/lib/ics";

/** GET /api/ics/tenants?q=…  — recherche dans l'index ICS (locataires + propriétaires). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canAccessIcsGed(session.user.roleId)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const where = q
    ? {
        OR: [
          { nomLocataire: { contains: q, mode: "insensitive" as const } },
          { prenomLocataire: { contains: q, mode: "insensitive" as const } },
          { nomProprietaire: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
          { adresseImmeuble: { contains: q, mode: "insensitive" as const } },
          { idBail: q },
        ],
      }
    : {};

  const [tenants, total] = await Promise.all([
    prisma.icsTenant.findMany({ where, orderBy: { nomLocataire: "asc" }, take: 100 }),
    prisma.icsTenant.count(),
  ]);

  return NextResponse.json({ tenants, total, shown: tenants.length });
}
