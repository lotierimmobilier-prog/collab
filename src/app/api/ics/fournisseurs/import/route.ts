import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { extractFournisseursPdf } from "@/lib/fournisseurs-import";
import { runMigrations } from "@/lib/run-migrations";

export const maxDuration = 60;

const ALLOWED = ["admin", "dirigeant", "direction", "gestionnaire", "syndic"];

// Mappe le métier ICS (riche) vers le type d'agence (catégorie large).
function mapType(metier?: string): string {
  const m = (metier ?? "").toLowerCase();
  if (/plomb|fuite|chauffage|sanitaire/.test(m)) return "plomberie";
  if (/electri|clim|froid|energie|elec/.test(m)) return "electricite";
  if (/menuis|charpent|fermeture|store/.test(m)) return "menuiserie";
  if (/macon|btp|gros.?oeuvre|etanch/.test(m)) return "maconnerie";
  if (/peinture|deco/.test(m)) return "peinture";
  return "autre";
}

// POST /api/ics/fournisseurs/import
//   body: { content: base64Pdf, scope?: "gestion"|"syndic", createContacts?: boolean }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? "")) {
    return NextResponse.json({ error: "Réservé à la direction et à la gestion." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const content = body?.content as string | undefined;
  const scope = body?.scope === "syndic" ? "syndic" : "gestion";
  const createContacts = body?.createContacts !== false;
  if (!content) return NextResponse.json({ error: "Fichier PDF manquant." }, { status: 400 });

  let parsed;
  try {
    parsed = await extractFournisseursPdf(content);
  } catch (e) {
    return NextResponse.json({ error: "Lecture du PDF impossible : " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
  if (!parsed.length) return NextResponse.json({ ok: true, imported: 0, contacts: 0, message: "Aucun fournisseur détecté dans le PDF." });

  let created = 0, updated = 0, contacts = 0;
  const errors: string[] = [];

  async function persist() {
    for (const f of parsed!) {
      try {
        const address = [f.adresse, [f.codePostal, f.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
        const data = {
          name: f.nom,
          type: mapType(f.metier),
          metier: f.metier ?? null,
          phone: f.mobile ?? f.tel ?? null,
          email: f.email ?? null,
          address,
          iban: f.iban ?? null,
          modeReglement: f.modeReglement ?? null,
          scope,
        };

        const existing = f.icsNum
          ? await prisma.supplier.findUnique({ where: { icsNum: f.icsNum } })
          : await prisma.supplier.findFirst({ where: { name: f.nom, scope } });

        let supId: string;
        if (existing) {
          await prisma.supplier.update({ where: { id: existing.id }, data });
          supId = existing.id;
          updated++;
        } else {
          const c = await prisma.supplier.create({ data: { ...data, icsNum: f.icsNum ?? null } });
          supId = c.id;
          created++;
        }

        if (createContacts) {
          const existingContact = await prisma.contact.findFirst({
            where: { type: "fournisseur", sourceType: "supplier", sourceId: supId },
          });
          const contactData = {
            type: "fournisseur",
            raisonSociale: f.nom,
            email: f.email ?? null,
            phone: f.mobile ?? f.tel ?? null,
            note: [f.metier, address].filter(Boolean).join(" · ") || null,
            sourceType: "supplier",
            sourceId: supId,
          };
          if (existingContact) {
            await prisma.contact.update({ where: { id: existingContact.id }, data: contactData });
          } else {
            const ct = await prisma.contact.create({ data: contactData });
            await prisma.supplier.update({ where: { id: supId }, data: { contactId: ct.id } });
            contacts++;
          }
        }
      } catch (e) {
        errors.push(`${f.nom}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  try {
    await persist();
  } catch (e) {
    // Colonnes ICS pas encore présentes → on répare puis on rejoue.
    if (/does not exist|column|icsNum|scope/i.test(String(e))) {
      await runMigrations();
      created = 0; updated = 0; contacts = 0; errors.length = 0;
      await persist();
    } else {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({
    ok: true,
    imported: created + updated,
    created, updated, contacts, scope,
    errors: errors.slice(0, 20),
    message: `${created} ajouté(s), ${updated} mis à jour${createContacts ? `, ${contacts} fiche(s) annuaire` : ""} (${scope}).`,
  });
}
