import { prisma } from "@/lib/prisma";
import { guessSupplierMetier, type MetierGuess } from "@/lib/supplier-metier";

export interface SupplierLite {
  id: string;
  name: string;
  address?: string | null;
  email?: string | null;
  siret?: string | null;
  metier?: string | null;
  type: string;
}

export interface EnrichResult extends MetierGuess {
  id: string;
  name: string;
  applied: boolean;
  previousType: string;
}

// Récupère quelques mails échangés avec ce fournisseur (objet + début du corps)
// pour aider Auguste à cerner le métier. Recherche par adresse exacte, sinon
// par domaine. Pas de cloisonnement par utilisateur : enrichissement annuaire
// réservé à la direction/gestion.
async function emailContext(email?: string | null): Promise<string[]> {
  if (!email) return [];
  const addr = email.toLowerCase().trim();
  const domain = addr.includes("@") ? addr.split("@")[1] : "";
  try {
    const msgs = await prisma.emailMessage.findMany({
      where: {
        OR: [
          { fromEmail: { contains: addr, mode: "insensitive" } },
          { toEmail: { contains: addr, mode: "insensitive" } },
          ...(domain ? [{ fromEmail: { contains: domain, mode: "insensitive" as const } }] : []),
        ],
      },
      select: { subject: true, bodyText: true },
      orderBy: { date: "desc" },
      take: 4,
    });
    return msgs
      .map(m => {
        const body = (m.bodyText || "").replace(/\s+/g, " ").trim().slice(0, 180);
        return [m.subject?.trim(), body].filter(Boolean).join(" — ");
      })
      .filter(Boolean);
  } catch {
    return []; // tables mail absentes / colonne manquante → on ignore
  }
}

// Enrichit un fournisseur : devine le métier (recherche web + mails) et, si
// `apply` et confiance suffisante, met à jour sa catégorie et son libellé métier.
export async function enrichSupplier(
  s: SupplierLite,
  opts: { apply?: boolean; minConfidence?: number } = {},
): Promise<EnrichResult> {
  const apply = opts.apply !== false;
  const minConfidence = opts.minConfidence ?? 55;

  const ctx = await emailContext(s.email);
  const guess = await guessSupplierMetier({
    name: s.name,
    address: s.address,
    email: s.email,
    siret: s.siret,
    currentMetier: s.metier,
    emailContext: ctx,
  });

  let applied = false;
  if (apply && guess.confidence >= minConfidence && guess.type !== "autre") {
    await prisma.supplier.update({
      where: { id: s.id },
      data: { type: guess.type, metier: guess.metier || s.metier || null },
    });
    applied = true;
  }

  return { ...guess, id: s.id, name: s.name, previousType: s.type, applied };
}
