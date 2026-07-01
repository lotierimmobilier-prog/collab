// Expéditeurs de confiance par utilisateur : leurs mails restent TOUJOURS en
// boîte de réception (jamais classés en « Publicité »). Alimenté par le bouton
// « Remettre en boîte de réception » d'un mail rangé en Publicité.
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const norm = (e: string) => (e ?? "").trim().toLowerCase();

// Ensemble des expéditeurs de confiance pour un (ou plusieurs) propriétaire(s).
export async function allowedSendersFor(ownerIds: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const ids = [...new Set(ownerIds.filter(Boolean))];
  if (!ids.length) return map;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "ownerId", email FROM mail_inbox_allow WHERE "ownerId" = ANY($1::text[])`, ids,
    );
    for (const r of rows) {
      if (!map.has(r.ownerId)) map.set(r.ownerId, new Set());
      map.get(r.ownerId)!.add(norm(r.email));
    }
  } catch { /* table absente → vide */ }
  return map;
}

export async function listAllowed(ownerId: string): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT email FROM mail_inbox_allow WHERE "ownerId" = $1 ORDER BY "createdAt" DESC`, ownerId,
    );
    return rows.map(r => r.email);
  } catch { return []; }
}

export async function addAllowed(ownerId: string, email: string): Promise<void> {
  const e = norm(email);
  if (!ownerId || !e) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO mail_inbox_allow (id, "ownerId", email) VALUES ($1, $2, $3)
       ON CONFLICT ("ownerId", email) DO NOTHING`,
    randomUUID(), ownerId, e,
  ).catch(() => {});
}

export async function removeAllowed(ownerId: string, email: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM mail_inbox_allow WHERE "ownerId" = $1 AND email = $2`, ownerId, norm(email),
  ).catch(() => {});
}
