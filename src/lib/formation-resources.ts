// Supports de formation rattachés à une compétence (lien externe ou fichier).
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const MAX_RESOURCE_BYTES = 15 * 1024 * 1024; // 15 Mo

export interface ResourceMeta { id: string; competenceId: string; title: string; url: string | null; fileName: string | null; mime: string | null; size: number | null; createdAt: string }

export async function listResources(competenceId: string): Promise<ResourceMeta[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, "competenceId", title, url, "fileName", mime, size, "createdAt"
         FROM training_resources WHERE "competenceId" = $1 ORDER BY "order" ASC, "createdAt" ASC`, competenceId,
    );
    return rows.map(r => ({ id: r.id, competenceId: r.competenceId, title: r.title, url: r.url, fileName: r.fileName, mime: r.mime, size: r.size, createdAt: new Date(r.createdAt).toISOString() }));
  } catch { return []; }
}

// Comptage par compétence (pour afficher un badge sans charger les listes).
export async function resourceCounts(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT "competenceId", count(*)::int AS n FROM training_resources GROUP BY "competenceId"`);
    for (const r of rows) map.set(r.competenceId, Number(r.n));
  } catch { /* vide */ }
  return map;
}

export async function addResource(competenceId: string, input: { title: string; url?: string | null; fileName?: string | null; mime?: string | null; size?: number | null; dataB64?: string | null }): Promise<{ id: string }> {
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO training_resources (id, "competenceId", title, url, "fileName", mime, size, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    id, competenceId, input.title.slice(0, 200), input.url || null, input.fileName ? input.fileName.slice(0, 200) : null, input.mime || null, input.size || null, input.dataB64 || null,
  );
  return { id };
}

export async function getResourceFile(id: string): Promise<{ fileName: string | null; mime: string | null; data: string } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT "fileName", mime, data FROM training_resources WHERE id = $1 LIMIT 1`, id);
    const r = rows[0];
    if (!r?.data) return null;
    return { fileName: r.fileName, mime: r.mime, data: r.data };
  } catch { return null; }
}

export async function removeResource(id: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM training_resources WHERE id = $1`, id).catch(() => {});
}
