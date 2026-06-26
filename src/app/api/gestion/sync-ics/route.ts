import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessIcsGed } from "@/lib/ics";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/gestion/sync-ics — peuple le module Gestion (propriétaires,
 * locataires, lots, baux) depuis l'index ICS importé. Idempotent : on retrouve
 * les enregistrements par leur référence ICS, donc rejouable sans doublon.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canAccessIcsGed(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction et à la gestion locative." }, { status: 403 });

  const tenants = await prisma.icsTenant.findMany();
  if (tenants.length === 0) return NextResponse.json({ error: "Index ICS vide : importez d'abord l'export Locataires." }, { status: 400 });

  const userId = session.user.id;
  const num = (v: string | null) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const date = (v: string | null) => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : new Date(); };

  let owners = 0, lots = 0, tnts = 0, baux = 0;
  const errors: string[] = [];

  for (const t of tenants) {
    try {
      // 1. Propriétaire (par idMandat)
      let ownerId: string | undefined;
      if (t.idMandat) {
        const o = await prisma.owner.upsert({
          where: { icsMandat: t.idMandat },
          update: { prenom: t.prenomProprietaire ?? "", nom: t.nomProprietaire ?? "—" },
          create: { icsMandat: t.idMandat, prenom: t.prenomProprietaire ?? "", nom: t.nomProprietaire ?? "—" },
        });
        ownerId = o.id; owners++;
      }

      // 2. Lot (par idLot)
      let lotId: string | undefined;
      if (t.idLot) {
        const l = await prisma.lot.upsert({
          where: { icsLot: t.idLot },
          update: { address: t.adresseImmeuble ?? t.nomImmeuble ?? "—", label: t.nomImmeuble, ownerId },
          create: { icsLot: t.idLot, reference: `ICS-${t.idLot}`, address: t.adresseImmeuble ?? t.nomImmeuble ?? "—", label: t.nomImmeuble, ownerId, status: "occupied" },
        });
        lotId = l.id; lots++;
      }
      if (!lotId) continue; // un bail nécessite un lot

      // 3. Locataire (par idBail)
      const tn = await prisma.tenant.upsert({
        where: { icsBail: t.idBail },
        update: { prenom: t.prenomLocataire ?? "", nom: t.nomLocataire ?? "—", email: t.email, mobile: t.mobile, phone: t.telephone },
        create: { icsBail: t.idBail, prenom: t.prenomLocataire ?? "", nom: t.nomLocataire ?? "—", email: t.email, mobile: t.mobile, phone: t.telephone },
      });
      tnts++;

      // 4. Bail (par idBail)
      const b = await prisma.bail.upsert({
        where: { icsBail: t.idBail },
        update: { lotId, monthlyRent: num(t.loyer), startDate: date(t.dateEffet) },
        create: { icsBail: t.idBail, reference: `ICS-${t.idBail}`, lotId, monthlyRent: num(t.loyer), startDate: date(t.dateEffet), status: "active", createdBy: userId },
      });
      baux++;

      // 5. Lien bail ↔ locataire
      await prisma.bailTenant.upsert({
        where: { bailId_tenantId: { bailId: b.id, tenantId: tn.id } },
        update: {},
        create: { bailId: b.id, tenantId: tn.id },
      });
    } catch (e) {
      if (errors.length < 6) errors.push(`bail ${t.idBail} : ${(e as Error).message}`);
    }
  }

  const [totOwners, totLots, totTenants, totBaux] = await Promise.all([
    prisma.owner.count(), prisma.lot.count(), prisma.tenant.count(), prisma.bail.count(),
  ]);

  return NextResponse.json({
    ok: errors.length === 0,
    traite: tenants.length,
    errors,
    message: `Synchronisation : ${owners} propriétaire(s), ${lots} lot(s), ${tnts} locataire(s), ${baux} bail/baux traités.` +
             (errors.length ? ` ⚠️ ${errors.length} erreur(s) : ${errors[0]}` : "") +
             ` Module Gestion : ${totOwners} propriétaires, ${totLots} lots, ${totTenants} locataires, ${totBaux} baux.`,
  });
}
