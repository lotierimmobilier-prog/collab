import { prisma } from "@/lib/prisma";

/**
 * Résout l'agent « propriétaire » d'une boîte mail à partir de sa config.
 * L'agent est le premier utilisateur assigné (sharedUserIds), sinon le
 * créateur de la config. Sert à étiqueter chaque message persité (ownerId)
 * pour le cloisonnement : seul l'agent (et non l'admin qui a paramétré la
 * boîte) accède au contenu.
 *
 * Pour les comptes non gérés en base (Gmail/local côté client), il n'y a pas
 * de config : l'appelant retombe sur l'utilisateur courant.
 */
export async function resolveAccountOwners(accountIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(accountIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const configs = await prisma.mailAccountConfig.findMany({
    where: { id: { in: ids } },
    select: { id: true, sharedUserIds: true, createdBy: true },
  });
  for (const c of configs) {
    const agent = (c.sharedUserIds && c.sharedUserIds[0]) || c.createdBy;
    if (agent) map.set(c.id, agent);
  }
  return map;
}

/** Variante pour un seul compte. */
export async function resolveAccountOwner(accountId: string): Promise<string | null> {
  const map = await resolveAccountOwners([accountId]);
  return map.get(accountId) ?? null;
}
