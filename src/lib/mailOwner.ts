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

/**
 * Cloisonnement STRICT du contenu : vérifie que l'utilisateur est bien agent
 * de la boîte (présent dans sharedUserIds, ou créateur d'une boîte perso).
 * Renvoie la config si l'accès est autorisé, sinon null.
 *
 * Sert à protéger toute opération qui touche le CONTENU d'une boîte gérée en
 * base (sync / body / search) : sans ce contrôle, un agent pouvait passer
 * l'identifiant d'une autre boîte et lire le courrier d'un collègue.
 * Pendant une impersonation, session.user.id est celui de l'agent consulté,
 * donc le cloisonnement reste correct.
 */
export async function accessibleMailAccount(userId: string | undefined | null, accountId: string | undefined | null) {
  if (!userId || !accountId) return null;
  const acc = await prisma.mailAccountConfig.findUnique({ where: { id: accountId } });
  if (!acc) return null;
  const isAgent = (acc.sharedUserIds ?? []).includes(userId) || acc.createdBy === userId;
  return isAgent ? acc : null;
}

/**
 * « Répare » le cloisonnement d'une boîte : ré-affecte ownerId de TOUS ses
 * messages à l'agent légitime (1er sharedUserId, sinon le créateur). Sert après
 * un changement de partage : les messages synchronisés par erreur par un autre
 * agent (avant le correctif d'accès) cessent ainsi d'apparaître chez lui.
 * Renvoie le nombre de messages ré-affectés.
 */
export async function normalizeAccountOwnership(accountId: string): Promise<number> {
  const acc = await prisma.mailAccountConfig.findUnique({ where: { id: accountId }, select: { sharedUserIds: true, createdBy: true } });
  if (!acc) return 0;
  const owner = (acc.sharedUserIds && acc.sharedUserIds[0]) || acc.createdBy;
  if (!owner) return 0;
  const res = await prisma.emailMessage.updateMany({ where: { accountId, ownerId: { not: owner } }, data: { ownerId: owner } });
  return res.count;
}
