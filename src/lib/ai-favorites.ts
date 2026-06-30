// Favoris d'assistants IA par utilisateur (épinglés en tête de la galerie).
// Stockés dans la table Setting sous la clé `ai_fav_<userId>` (liste JSON d'IDs).
import { prisma } from "@/lib/prisma";

const keyFor = (uid: string) => `ai_fav_${uid}`;

export async function getFavorites(uid: string): Promise<string[]> {
  if (!uid) return [];
  const s = await prisma.setting.findUnique({ where: { key: keyFor(uid) } }).catch(() => null);
  try { return s?.value ? (JSON.parse(s.value) as string[]) : []; } catch { return []; }
}

export async function toggleFavorite(uid: string, agentId: string): Promise<{ favorites: string[]; favorited: boolean }> {
  const cur = await getFavorites(uid);
  const has = cur.includes(agentId);
  const next = has ? cur.filter((x) => x !== agentId) : [...cur, agentId];
  const value = JSON.stringify(next);
  await prisma.setting.upsert({
    where: { key: keyFor(uid) },
    update: { value },
    create: { key: keyFor(uid), value },
  }).catch(() => {});
  return { favorites: next, favorited: !has };
}
