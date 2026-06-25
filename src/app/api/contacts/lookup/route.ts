import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Recherche un email dans tout l'annuaire (table contacts unifiée + entités
 * métier : propriétaires, locataires, fournisseurs, utilisateurs).
 * Sert à savoir si un expéditeur de mail est déjà connu.
 *
 * GET /api/contacts/lookup?email=...
 *  → { found, type, name, source }
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const email = (req.nextUrl.searchParams.get("email") || "").toLowerCase().trim();
  if (!email) return NextResponse.json({ found: false });

  const ci = { equals: email, mode: "insensitive" as const };

  // Carnet unifié d'abord
  const contact = await prisma.contact.findFirst({ where: { email: ci } });
  if (contact) {
    const name = contact.raisonSociale || [contact.prenom, contact.nom].filter(Boolean).join(" ") || email;
    return NextResponse.json({ found: true, type: contact.type, name, source: "contact", id: contact.id });
  }

  const [owner, tenant, supplier, user] = await Promise.all([
    prisma.owner.findFirst({ where: { email: ci }, select: { id: true, prenom: true, nom: true } }),
    prisma.tenant.findFirst({ where: { email: ci }, select: { id: true, prenom: true, nom: true } }),
    prisma.supplier.findFirst({ where: { email: ci }, select: { id: true, name: true } }),
    prisma.user.findFirst({ where: { email: ci }, select: { id: true, prenom: true, nom: true, roleId: true } }),
  ]);

  if (owner)    return NextResponse.json({ found: true, type: "proprietaire", name: `${owner.prenom} ${owner.nom}`,   source: "owner",    id: owner.id });
  if (tenant)   return NextResponse.json({ found: true, type: "locataire",    name: `${tenant.prenom} ${tenant.nom}`, source: "tenant",   id: tenant.id });
  if (supplier) return NextResponse.json({ found: true, type: "fournisseur",  name: supplier.name,                    source: "supplier", id: supplier.id });
  if (user)     return NextResponse.json({ found: true, type: user.roleId === "commercial" ? "commercial" : "direction", name: `${user.prenom} ${user.nom}`, source: "user", id: user.id });

  return NextResponse.json({ found: false });
}
