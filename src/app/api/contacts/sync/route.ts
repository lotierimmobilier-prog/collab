import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/contacts/sync
 * Rapproche les entités métier existantes (propriétaires, locataires,
 * fournisseurs, utilisateurs) dans l'annuaire unifié `Contact`.
 * Idempotent : on ne réimporte pas un contact déjà rattaché (sourceType+sourceId)
 * ni un email déjà présent dans l'annuaire.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [owners, tenants, suppliers, users, existing] = await Promise.all([
    prisma.owner.findMany({ select: { id: true, prenom: true, nom: true, email: true, phone: true } }),
    prisma.tenant.findMany({ select: { id: true, prenom: true, nom: true, email: true, phone: true } }),
    prisma.supplier.findMany({ select: { id: true, name: true, contact: true, email: true, phone: true } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true, email: true, roleId: true } }),
    prisma.contact.findMany({ select: { sourceType: true, sourceId: true, email: true } }),
  ]);

  const seenSource = new Set(existing.filter(c => c.sourceType && c.sourceId).map(c => `${c.sourceType}:${c.sourceId}`));
  const seenEmail  = new Set(existing.filter(c => c.email).map(c => c.email!.toLowerCase()));

  const rows: Array<{
    type: string; prenom: string | null; nom: string | null; raisonSociale: string | null;
    email: string | null; phone: string | null; sourceType: string; sourceId: string; createdById: string;
  }> = [];

  const push = (
    type: string, sourceType: string, sourceId: string,
    prenom: string | null, nom: string | null, raisonSociale: string | null,
    email: string | null, phone: string | null,
  ) => {
    if (seenSource.has(`${sourceType}:${sourceId}`)) return;
    const e = (email || "").toLowerCase().trim() || null;
    if (e && seenEmail.has(e)) return;       // déjà dans l'annuaire (ajout manuel par ex.)
    if (e) seenEmail.add(e);
    rows.push({ type, prenom, nom, raisonSociale, email: e, phone: phone || null, sourceType, sourceId, createdById: session.user!.id });
  };

  for (const o of owners)   push("proprietaire", "owner",    o.id, o.prenom, o.nom, null, o.email, o.phone);
  for (const t of tenants)  push("locataire",    "tenant",   t.id, t.prenom, t.nom, null, t.email, t.phone);
  for (const s of suppliers) push("fournisseur", "supplier", s.id, s.contact || null, null, s.name, s.email, s.phone);
  for (const u of users) {
    const r = (u.roleId || "").toLowerCase();
    const type = r.includes("commercial") || r.includes("agent") ? "commercial" : "direction";
    push(type, "user", u.id, u.prenom, u.nom, null, u.email, null);
  }

  if (rows.length === 0) return NextResponse.json({ ok: true, imported: 0 });

  const res = await prisma.contact.createMany({ data: rows });
  return NextResponse.json({ ok: true, imported: res.count });
}
