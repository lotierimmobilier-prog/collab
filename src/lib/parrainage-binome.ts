// Résolution du binôme parrainage d'un utilisateur (son parrain + ses filleuls)
// pour le planning partagé. La relation est stockée dans user_extras.parrainId.
import { prisma } from "@/lib/prisma";
import { getExtra, filleulsOf } from "@/lib/user-extras";

export type BinomeRole = "parrain" | "filleul";
export interface Binome { id: string; name: string; role: BinomeRole; }

// Couleurs de différenciation sur le planning partagé.
export const PARRAIN_COLOR = "#1A3A5C"; // bleu nuit — créneaux proposés par le parrain
export const FILLEUL_COLOR = "#B8966A"; // or — créneaux proposés par le filleul

// Rôle du créateur d'un créneau, connaissant le rôle du binôme choisi.
// Si le binôme est mon parrain, alors moi (créateur) suis le filleul, et vice-versa.
export function proposerRole(binomeRole: BinomeRole): BinomeRole {
  return binomeRole === "parrain" ? "filleul" : "parrain";
}
export function colorForRole(role: BinomeRole): string {
  return role === "parrain" ? PARRAIN_COLOR : FILLEUL_COLOR;
}

export async function getBinomes(userId: string): Promise<Binome[]> {
  const [ex, filleulIds] = await Promise.all([getExtra(userId), filleulsOf(userId)]);
  const seen = new Set<string>();
  const raw: { id: string; role: BinomeRole }[] = [];
  if (ex?.parrainId && ex.parrainId !== userId) { raw.push({ id: ex.parrainId, role: "parrain" }); seen.add(ex.parrainId); }
  for (const fid of filleulIds) if (fid !== userId && !seen.has(fid)) { raw.push({ id: fid, role: "filleul" }); seen.add(fid); }
  if (!raw.length) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: raw.map(o => o.id) }, active: true },
    select: { id: true, prenom: true, nom: true },
  }).catch(() => []);
  const nameOf = new Map(users.map(u => [u.id, `${u.prenom} ${u.nom}`.trim()]));
  return raw.filter(o => nameOf.has(o.id)).map(o => ({ id: o.id, name: nameOf.get(o.id)!, role: o.role }));
}
