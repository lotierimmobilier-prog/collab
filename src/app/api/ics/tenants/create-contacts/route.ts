import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";

export const runtime = "nodejs";

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const nameKey = (nom?: string | null, prenom?: string | null) => `${norm(nom)}|${norm(prenom)}`;

/**
 * POST /api/ics/tenants/create-contacts — crée dans l'annuaire les contacts
 * (locataires + propriétaires) issus de l'index ICS importé, sans doublon.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirection(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const tenants = await prisma.icsTenant.findMany();
  if (tenants.length === 0) return NextResponse.json({ error: "Index ICS vide : importez d'abord l'export Locataires." }, { status: 400 });

  type C = { email: string | null; nom: string | null; prenom: string | null; icsRef: string | null };
  const existing = await prisma.contact.findMany({ select: { email: true, nom: true, prenom: true, icsRef: true } }) as C[];
  const byEmail = new Set(existing.filter(c => c.email).map(c => norm(c.email)));
  const byName = new Set(existing.filter(c => c.nom).map(c => nameKey(c.nom, c.prenom)));
  const byRef = new Set(existing.filter(c => c.icsRef).map(c => c.icsRef!));

  // On évite aussi les doublons à l'intérieur du lot (un même propriétaire revient).
  const seenName = new Set<string>();
  const toCreate: { type: string; prenom: string | null; nom: string | null; email: string | null; phone: string | null; icsType: string; icsRef: string | null; icsIdLot: string | null; createdById: string }[] = [];

  function consider(type: "locataire" | "proprietaire", prenom: string | null, nom: string | null, email: string | null, phone: string | null, icsRef: string | null, icsIdLot: string | null) {
    if (!nom && !prenom && !email) return;
    const nk = nameKey(nom, prenom);
    const em = email ? norm(email) : "";
    if (icsRef && byRef.has(icsRef)) return;
    if (em && byEmail.has(em)) return;
    if (nk !== "|" && (byName.has(nk) || seenName.has(`${type}:${nk}`))) return;
    seenName.add(`${type}:${nk}`);
    toCreate.push({ type, prenom, nom, email, phone, icsType: type, icsRef, icsIdLot, createdById: session!.user!.id! });
  }

  for (const t of tenants) {
    consider("locataire", t.prenomLocataire, t.nomLocataire, t.email, t.mobile ?? t.telephone, t.idBail, t.idLot);
    consider("proprietaire", t.prenomProprietaire, t.nomProprietaire, null, null, t.idMandat, t.idLot);
  }

  if (toCreate.length > 0) await prisma.contact.createMany({ data: toCreate });

  const locataires = toCreate.filter(c => c.type === "locataire").length;
  const proprietaires = toCreate.filter(c => c.type === "proprietaire").length;
  return NextResponse.json({
    ok: true, created: toCreate.length, locataires, proprietaires,
    message: `${toCreate.length} contact(s) créé(s) dans l'annuaire (${locataires} locataire(s), ${proprietaires} propriétaire(s)). Les doublons ont été ignorés.`,
  });
}
