// Drive Parrain/Filleul : partage de documents sur toute la lignée de
// parrainage (ascendants + descendants). Tables gérées par l'app (SQL brut).
import { prisma } from "@/lib/prisma";
import { getExtras, filleulsOf } from "@/lib/user-extras";

// Ensemble des utilisateurs de la lignée d'un utilisateur : lui-même, ses
// parrains successifs (vers le haut) et tous ses filleuls en cascade (vers le
// bas). Un document est visible par tous les membres de cette lignée.
export async function mentorLineage(userId: string): Promise<Set<string>> {
  const set = new Set<string>([userId]);

  // Ascendants (parrain, grand-parrain, …)
  let cur: string | null = userId;
  for (let i = 0; i < 25 && cur; i++) {
    const ex = await getExtras([cur]);
    const p: string | null = ex.get(cur)?.parrainId ?? null;
    if (!p || set.has(p)) break;
    set.add(p);
    cur = p;
  }

  // Descendants (filleuls, filleuls de filleuls, …)
  const queue = [userId];
  while (queue.length) {
    const x = queue.shift() as string;
    const kids = await filleulsOf(x);
    for (const k of kids) if (!set.has(k)) { set.add(k); queue.push(k); }
  }

  return set;
}

export interface ParrainageDoc {
  id: string; ownerId: string; ownerName?: string; fileName: string;
  mime: string | null; size: number | null; note: string | null; createdAt: string;
}

// Liste les documents visibles par l'utilisateur (métadonnées, sans le contenu).
export async function listDocsFor(userId: string): Promise<ParrainageDoc[]> {
  const ids = [...(await mentorLineage(userId))];
  if (!ids.length) return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT d.id, d."ownerId", d."fileName", d.mime, d.size, d.note, d."createdAt",
              u.prenom, u.nom
         FROM parrainage_doc d LEFT JOIN users u ON u.id = d."ownerId"
        WHERE d."ownerId" = ANY($1::text[])
        ORDER BY d."createdAt" DESC`, ids,
    );
    return rows.map(r => ({
      id: r.id, ownerId: r.ownerId, ownerName: r.prenom ? `${r.prenom} ${r.nom}` : undefined,
      fileName: r.fileName, mime: r.mime, size: r.size, note: r.note,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  } catch { return []; }
}

// Vérifie qu'un document est visible par l'utilisateur, et renvoie son contenu.
export async function getDocForUser(userId: string, docId: string): Promise<{ fileName: string; mime: string | null; data: string } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT "ownerId", "fileName", mime, data FROM parrainage_doc WHERE id = $1`, docId);
    const doc = rows[0];
    if (!doc) return null;
    const lineage = await mentorLineage(userId);
    if (!lineage.has(doc.ownerId)) return null; // hors lignée → pas d'accès
    return { fileName: doc.fileName, mime: doc.mime, data: doc.data };
  } catch { return null; }
}
