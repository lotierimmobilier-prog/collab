import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enrichSupplier } from "@/lib/supplier-enrich";

export const maxDuration = 300;

const ALLOWED = ["admin", "dirigeant", "direction", "gestionnaire", "syndic"];

// POST /api/fournisseurs/metier/enrich-missing
//   Complète via Auguste (recherche web) le métier des fournisseurs sans
//   catégorie (type "autre"). Traité par lots pour rester dans le délai.
//   body: { limit?: number, scope?: "gestion"|"syndic" }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? "")) {
    return NextResponse.json({ error: "Réservé à la direction et à la gestion." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Math.max(Number(body?.limit) || 12, 1), 25);
  const scope = body?.scope === "syndic" || body?.scope === "gestion" ? body.scope : undefined;

  const suppliers = await prisma.supplier.findMany({
    where: { type: "autre", active: true, ...(scope ? { scope } : {}) },
    select: { id: true, name: true, address: true, email: true, siret: true, metier: true, type: true },
    orderBy: { name: "asc" },
    take: limit,
  });

  const results = [];
  let updated = 0;
  // Séquentiel : la recherche web est coûteuse et on évite de saturer le proxy.
  for (const s of suppliers) {
    try {
      const r = await enrichSupplier(s, { apply: true });
      if (r.applied) updated++;
      results.push({ id: r.id, name: r.name, type: r.type, metier: r.metier, confidence: r.confidence, applied: r.applied });
    } catch (e) {
      results.push({ id: s.id, name: s.name, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const remaining = await prisma.supplier.count({ where: { type: "autre", active: true, ...(scope ? { scope } : {}) } });
  return NextResponse.json({
    ok: true,
    processed: suppliers.length,
    updated,
    remaining,
    results,
    message: `${updated} métier(s) complété(s) sur ${suppliers.length} traité(s). ${remaining} fournisseur(s) encore sans catégorie.`,
  });
}
