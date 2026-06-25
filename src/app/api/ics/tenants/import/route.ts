import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";
import { parseIcsTenantsExport } from "@/lib/ics-import";

export const runtime = "nodejs";

/** POST /api/ics/tenants/import — multipart « file » : export ICS Locataires. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirection(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 400 });

  let parsed;
  try {
    parsed = parseIcsTenantsExport(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json({ error: `Lecture du fichier impossible : ${(e as Error).message}` }, { status: 400 });
  }

  if (parsed.records.length === 0) {
    return NextResponse.json({ error: "Aucune ligne avec idBail trouvée. Vérifiez qu'il s'agit bien de l'export ICS « Locataires »." }, { status: 400 });
  }

  for (const r of parsed.records) {
    await prisma.icsTenant.upsert({ where: { idBail: r.idBail }, create: r, update: r });
  }
  const total = await prisma.icsTenant.count();

  // Rapprochement avec l'annuaire : on relie les fiches existantes aux références
  // ICS (locataire → idBail, propriétaire → idMandat), sans rien créer.
  const linked = await linkContacts(parsed.records);

  return NextResponse.json({
    ok: true,
    imported: parsed.records.length,
    skipped: parsed.skipped,
    totalLignes: parsed.total,
    totalEnBase: total,
    linked,
    message: `${parsed.records.length} bail/baux importés. ${linked} fiche(s) d'annuaire rapprochée(s) d'ICS. Index : ${total} entrées.`,
  });
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const nameKey = (nom?: string | null, prenom?: string | null) => `${norm(nom)}|${norm(prenom)}`;

/** Relie les contacts de l'annuaire aux références ICS. Renvoie le nombre de fiches mises à jour. */
async function linkContacts(records: { idBail: string; idMandat: string | null; idLot: string | null;
  nomLocataire: string | null; prenomLocataire: string | null; email: string | null; mobile: string | null;
  nomProprietaire: string | null; prenomProprietaire: string | null; }[]): Promise<number> {
  const contacts = await prisma.contact.findMany({
    select: { id: true, email: true, nom: true, prenom: true, phone: true, icsRef: true },
  });
  const byEmail = new Map<string, typeof contacts[number]>();
  const byName = new Map<string, typeof contacts[number]>();
  for (const c of contacts) {
    if (c.email) byEmail.set(norm(c.email), c);
    if (c.nom) byName.set(nameKey(c.nom, c.prenom), c);
  }

  const updates = new Map<string, { icsType: string; icsRef: string; icsIdLot: string | null; phone?: string }>();
  for (const r of records) {
    // Locataire : email d'abord (fiable), sinon nom+prénom.
    const loc = (r.email && byEmail.get(norm(r.email))) || byName.get(nameKey(r.nomLocataire, r.prenomLocataire));
    if (loc && !updates.has(loc.id)) {
      updates.set(loc.id, { icsType: "locataire", icsRef: r.idBail, icsIdLot: r.idLot, phone: loc.phone ? undefined : (r.mobile ?? undefined) });
    }
    // Propriétaire : par nom+prénom uniquement (pas d'email dans cet export).
    const prop = r.idMandat ? byName.get(nameKey(r.nomProprietaire, r.prenomProprietaire)) : undefined;
    if (prop && !updates.has(prop.id)) {
      updates.set(prop.id, { icsType: "proprietaire", icsRef: r.idMandat!, icsIdLot: r.idLot });
    }
  }

  let n = 0;
  for (const [id, data] of updates) {
    await prisma.contact.update({ where: { id }, data });
    n++;
  }
  return n;
}
