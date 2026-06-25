import { prisma } from "@/lib/prisma";

/**
 * Routage des emails d'après l'historique RÉEL.
 *
 * Détermine quel agent doit traiter un expéditeur donné, non pas en le
 * devinant, mais en s'appuyant sur ce qui s'est réellement passé :
 *   1. les assignations passées (labels `assigned:<userId>` sur les mails
 *      déjà reçus de cet expéditeur) ;
 *   2. les réponses déjà envoyées à cet expéditeur (mail SENT dont l'auteur
 *      — `fromEmail` — correspond à un utilisateur de l'agence).
 *
 * Le signal le plus fréquent l'emporte. Sert à la fois au classement par
 * lot (auto-classify) et au classement d'une conversation isolée.
 */

export interface HandlerHint {
  userId: string;
  /** Explication lisible, ex. « a déjà traité 3 mails de cet expéditeur ». */
  reason: string;
}

/** Renvoie l'élément le plus fréquent d'une liste (ou null si vide). */
function topCount<T>(items: T[]): { value: T; count: number } | null {
  const tally = new Map<T, number>();
  for (const it of items) tally.set(it, (tally.get(it) ?? 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of tally) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

/**
 * Calcule le traitant historique pour un lot d'expéditeurs.
 * @param fromEmails liste d'emails expéditeurs (casse indifférente)
 * @param validUserIds identifiants d'agents actifs autorisés
 * @returns map email (minuscule) → { userId, reason }
 */
export async function historicalHandlers(
  fromEmails: string[],
  validUserIds: Set<string>,
): Promise<Map<string, HandlerHint>> {
  const emails = [...new Set(fromEmails.map(e => (e || "").toLowerCase()).filter(Boolean))];
  const result = new Map<string, HandlerHint>();
  if (emails.length === 0) return result;

  // Carte email agence → utilisateur (pour relier une réponse à son auteur)
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, email: true, prenom: true, nom: true },
  });
  const userByEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));

  // 1) Mails REÇUS de ces expéditeurs et déjà assignés
  const inbound = await prisma.emailMessage.findMany({
    where: {
      folder: "INBOX",
      OR: emails.map(e => ({ fromEmail: { equals: e, mode: "insensitive" as const } })),
    },
    select: { fromEmail: true, labels: true },
    take: 800,
  });

  // 2) Réponses ENVOYÉES à ces expéditeurs
  const sent = await prisma.emailMessage.findMany({
    where: {
      folder: "SENT",
      OR: emails.map(e => ({ toEmail: { contains: e, mode: "insensitive" as const } })),
    },
    select: { fromEmail: true, toEmail: true },
    take: 800,
  });

  for (const email of emails) {
    // a) assignations passées sur les mails reçus de cet expéditeur
    const assignedIds: string[] = [];
    for (const m of inbound) {
      if (m.fromEmail.toLowerCase() !== email) continue;
      for (const l of m.labels) {
        if (l.startsWith("assigned:")) {
          const id = l.slice("assigned:".length);
          if (validUserIds.has(id)) assignedIds.push(id);
        }
      }
    }
    const topAssign = topCount(assignedIds);
    if (topAssign) {
      const u = users.find(x => x.id === topAssign.value);
      result.set(email, {
        userId: topAssign.value,
        reason: `déjà assigné ${topAssign.count}× à ${u ? `${u.prenom} ${u.nom}` : "cet agent"} pour cet expéditeur`,
      });
      continue;
    }

    // b) à défaut : qui a répondu à cet expéditeur (auteur des mails SENT)
    const replierIds: string[] = [];
    for (const m of sent) {
      if (!m.toEmail.toLowerCase().includes(email)) continue;
      const author = userByEmail.get((m.fromEmail || "").toLowerCase());
      if (author && validUserIds.has(author.id)) replierIds.push(author.id);
    }
    const topReply = topCount(replierIds);
    if (topReply) {
      const u = users.find(x => x.id === topReply.value);
      result.set(email, {
        userId: topReply.value,
        reason: `${u ? `${u.prenom} ${u.nom}` : "cet agent"} a déjà répondu ${topReply.count}× à cet expéditeur`,
      });
    }
  }

  return result;
}

/** Variante pratique pour un seul expéditeur. */
export async function historicalHandler(
  fromEmail: string,
  validUserIds: Set<string>,
): Promise<HandlerHint | null> {
  const map = await historicalHandlers([fromEmail], validUserIds);
  return map.get((fromEmail || "").toLowerCase()) ?? null;
}
