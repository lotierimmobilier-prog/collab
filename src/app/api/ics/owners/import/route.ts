import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";
import { parseIcsOwnersExport } from "@/lib/ics-import";

export const runtime = "nodejs";

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const nameKey = (nom?: string | null, prenom?: string | null) => `${norm(nom)}|${norm(prenom)}`;

/** POST /api/ics/owners/import — import/MAJ des propriétaires dans l'annuaire. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirection(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 400 });

  let parsed;
  try { parsed = parseIcsOwnersExport(Buffer.from(await file.arrayBuffer())); }
  catch (e) { return NextResponse.json({ error: `Lecture impossible : ${(e as Error).message}` }, { status: 400 }); }
  if (parsed.records.length === 0) {
    return NextResponse.json({ error: "Aucun propriétaire trouvé. Vérifiez qu'il s'agit de l'export ICS « Propriétaires »." }, { status: 400 });
  }

  type C = { id: string; email: string | null; nom: string | null; prenom: string | null; phone: string | null; note: string | null; icsRef: string | null };
  const existing = await prisma.contact.findMany({
    select: { id: true, email: true, nom: true, prenom: true, phone: true, note: true, icsRef: true },
  }) as C[];
  const byRef = new Map<string, C>(); const byEmail = new Map<string, C>(); const byName = new Map<string, C>();
  for (const c of existing) {
    if (c.icsRef) byRef.set(c.icsRef, c);
    if (c.email) byEmail.set(norm(c.email), c);
    if (c.nom) byName.set(nameKey(c.nom, c.prenom), c);
  }

  let created = 0, updated = 0, unchanged = 0;
  for (const o of parsed.records) {
    const data = {
      type: "proprietaire", prenom: o.prenom, nom: o.nom, email: o.email, phone: o.phone,
      note: o.adresse, icsType: "proprietaire", icsRef: o.idMandat, icsIdLot: null as string | null,
    };
    const match = (o.idMandat && byRef.get(o.idMandat))
      || (o.email && byEmail.get(norm(o.email)))
      || byName.get(nameKey(o.nom, o.prenom));

    if (!match) {
      await prisma.contact.create({ data: { ...data, createdById: session.user.id } });
      created++;
      continue;
    }
    const changed = norm(match.email) !== norm(o.email) || norm(match.phone) !== norm(o.phone)
      || norm(match.nom) !== norm(o.nom) || norm(match.prenom) !== norm(o.prenom)
      || (match.icsRef ?? "") !== (o.idMandat ?? "") || norm(match.note) !== norm(o.adresse);
    if (changed) { await prisma.contact.update({ where: { id: match.id }, data }); updated++; }
    else unchanged++;
  }

  return NextResponse.json({
    ok: true, created, updated, unchanged, total: parsed.records.length,
    message: `${created} nouveau(x), ${updated} mis à jour, ${unchanged} inchangé(s) — ${parsed.records.length} propriétaires.`,
  });
}
