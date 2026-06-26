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
  const orNull = (s: string | undefined | null) => { const v = (s ?? "").trim(); return v === "" ? null : v; };
  const num = (v: string | undefined | null) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const date = (v: string | undefined | null) => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : new Date(); };
  const dateN = (v: string | undefined | null) => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : null; };
  const norm = (s: string | null) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
  const PRO_CIV = ["SCI", "SAS", "SARL", "EURL", "SNC", "SCCV", "SC", "GFA", "STE", "SOCIETE", "COPROPRIETE", "INDIVISION"];
  const notesFrom = (raw: Record<string, string>, fields: [string, string][]) =>
    fields.map(([k, label]) => { const v = (raw[k] ?? "").trim(); return v ? `${label} : ${v}` : ""; }).filter(Boolean).join("\n") || null;
  const mapLotType = (s: string) => { const v = s.toLowerCase(); if (/villa|maison/.test(v)) return "house"; if (/local|commerc|bureau/.test(v)) return "commercial"; if (/parking|garage|stationn/.test(v)) return "parking"; if (/cave|box|stockage|grenier/.test(v)) return "storage"; return "apartment"; };
  const mapLeaseType = (cat: string, typ: string) => { const v = `${cat} ${typ}`.toLowerCase(); if (/commerc/.test(v)) return "commercial"; if (/mixte/.test(v)) return "mixed"; return "residential"; };

  // Coordonnées propriétaires depuis l'annuaire (import Propriétaires) pour enrichir.
  const proContacts = await prisma.contact.findMany({ where: { icsType: "proprietaire" }, select: { nom: true, prenom: true, raisonSociale: true, email: true, phone: true } });
  const proByName = new Map<string, { email: string | null; phone: string | null }>();
  for (const c of proContacts as { nom: string | null; prenom: string | null; raisonSociale: string | null; email: string | null; phone: string | null }[]) {
    const k = norm(c.raisonSociale || `${c.nom ?? ""} ${c.prenom ?? ""}`);
    if (k && !proByName.has(k)) proByName.set(k, { email: c.email, phone: c.phone });
  }

  const ownerKeys = new Set<string>();
  let lots = 0, tnts = 0, baux = 0;
  const errors: string[] = [];

  for (const t of tenants) {
    try {
      const raw = (t.raw ?? {}) as Record<string, string>;

      // 1. Propriétaire — REGROUPÉ par nom, marqué professionnel/SCI, enrichi.
      let ownerId: string | undefined;
      const civ = norm(t.civiliteProprio);
      const isSci = civ === "SCI";
      const isCompany = PRO_CIV.includes(civ);
      const rawNom = (t.nomProprietaire ?? "").trim();
      const rawPrenom = (t.prenomProprietaire ?? "").trim();
      const key = norm(isCompany ? rawNom : `${rawNom} ${rawPrenom}`);
      if (rawNom && key) {
        const pc = proByName.get(key);
        const ownerNotes = [
          isCompany && rawPrenom ? `Représentant : ${rawPrenom}` : "",
          notesFrom(raw, [["DateNaissanceProprietaire", "Né(e) le"], ["LieuNaissanceProprietaire", "Lieu de naissance"], ["numeroRegistre", "N° registre"], ["dateFinMandat", "Fin de mandat"]]) ?? "",
        ].filter(Boolean).join("\n") || null;
        const ownerData = {
          ownerType: isSci ? "sci" : isCompany ? "company" : "individual",
          companyName: isCompany ? rawNom : null,
          nom: rawNom, prenom: isCompany ? "" : rawPrenom,
          email: pc?.email ?? null, phone: pc?.phone ?? null,
          notes: ownerNotes, icsMandat: t.idMandat,
        };
        const o = await prisma.owner.upsert({ where: { icsKey: key }, update: ownerData, create: { icsKey: key, ...ownerData } });
        ownerId = o.id; ownerKeys.add(key);
      }

      // 2. Lot (par idLot) — type, surface, diagnostics…
      let lotId: string | undefined;
      if (t.idLot) {
        const lotData = {
          address: t.adresseImmeuble ?? t.nomImmeuble ?? "—", label: t.nomImmeuble, ownerId,
          lotType: mapLotType(raw["typeLot"] ?? ""), surface: num(raw["Surface habitable"]) || null,
          notes: notesFrom(raw, [["Code porte", "Code porte"], ["lotSyndic", "Lot syndic"], ["N Identifiant Fiscal", "N° identifiant fiscal"], ["DPE", "DPE"], ["GES", "GES"], ["Classe DPE", "Classe DPE"], ["Classe GES", "Classe GES"], ["Date Diagnostic", "Date diagnostic"], ["LotDescriptif", "Descriptif"], ["Adresse de facturation", "Adresse de facturation"]]),
        };
        const l = await prisma.lot.upsert({
          where: { icsLot: t.idLot },
          update: lotData,
          create: { icsLot: t.idLot, reference: `ICS-${t.idLot}`, status: "occupied", ...lotData },
        });
        lotId = l.id; lots++;
      }
      if (!lotId) continue; // un bail nécessite un lot

      // 3. Locataire (par idBail) — naissance, coordonnées bancaires en note…
      const tenantData = {
        prenom: t.prenomLocataire ?? "", nom: t.nomLocataire ?? "—",
        email: t.email, mobile: t.mobile, phone: t.telephone,
        address: t.adresseImmeuble ?? null, birthDate: orNull(raw["DateNaissanceLocataire"]),
        notes: notesFrom(raw, [["NumeroSiret", "SIRET"], ["iban", "IBAN"], ["bic", "BIC"], ["RUM", "RUM"], ["Nom banque", "Banque"], ["LieuNaissanceLocataire", "Lieu de naissance"], ["autorisationEmail", "Autorisation email"], ["autorisationSMS", "Autorisation SMS"]]),
      };
      const tn = await prisma.tenant.upsert({
        where: { icsBail: t.idBail },
        update: tenantData,
        create: { icsBail: t.idBail, ...tenantData },
      });
      tnts++;

      // 4. Bail (par idBail) — loyer, charges, dépôt, type, dates, révision…
      const bailData = {
        lotId, monthlyRent: num(t.loyer), charges: num(raw["Provision sur Charges"]),
        deposit: num(raw["Montant DG"]) || null, startDate: date(t.dateEffet),
        signedDate: dateN(raw["date signature"]), leaseType: mapLeaseType(t.categorieBail ?? "", t.typeBail ?? ""),
        notes: notesFrom(raw, [["typeBail", "Type de bail"], ["categorieBail", "Catégorie"], ["Indice", "Indice de révision"], ["Priodicit", "Périodicité"], ["Date Prochain Appel", "Prochain appel"], ["Date derniere revision", "Dernière révision"], ["Reversement DG", "Reversement DG"], ["GLI", "GLI"], ["PNO", "PNO"], ["titre", "Titre"]]),
      };
      const b = await prisma.bail.upsert({
        where: { icsBail: t.idBail },
        update: bailData,
        create: { icsBail: t.idBail, reference: `ICS-${t.idBail}`, status: "active", createdBy: userId, ...bailData },
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

  // Nettoyage : supprime les anciens comptes propriétaires ICS désormais sans lot
  // (issus du regroupement par mandat → regroupement par nom).
  let cleaned = 0;
  try {
    const orphans = await prisma.owner.findMany({
      where: { OR: [{ icsKey: { not: null } }, { icsMandat: { not: null } }], lots: { none: {} } },
      select: { id: true },
    });
    if (orphans.length) {
      const res = await prisma.owner.deleteMany({ where: { id: { in: orphans.map((o: { id: string }) => o.id) } } });
      cleaned = res.count;
    }
  } catch { /* best-effort */ }

  const [totOwners, totLots, totTenants, totBaux] = await Promise.all([
    prisma.owner.count(), prisma.lot.count(), prisma.tenant.count(), prisma.bail.count(),
  ]);

  return NextResponse.json({
    ok: errors.length === 0,
    traite: tenants.length,
    errors,
    message: `Synchronisation : ${ownerKeys.size} propriétaire(s) regroupé(s), ${lots} lot(s), ${tnts} locataire(s), ${baux} bail/baux traités.` +
             (cleaned ? ` ${cleaned} doublon(s) propriétaire nettoyé(s).` : "") +
             (errors.length ? ` ⚠️ ${errors.length} erreur(s) : ${errors[0]}` : "") +
             ` Module Gestion : ${totOwners} propriétaires, ${totLots} lots, ${totTenants} locataires, ${totBaux} baux.`,
  });
}
