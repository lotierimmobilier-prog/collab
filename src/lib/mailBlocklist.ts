// Expéditeurs indésirables (spam) par utilisateur. Les mails entrants d'un
// expéditeur bloqué sont classés directement en corbeille à la réception.
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const norm = (e: string) => (e ?? "").trim().toLowerCase();

// Ensemble des expéditeurs bloqués pour un (ou plusieurs) propriétaire(s) de boîte.
export async function blockedSendersFor(ownerIds: string[]): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  const ids = [...new Set(ownerIds.filter(Boolean))];
  if (!ids.length) return map;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "ownerId", email FROM mail_blocked_senders WHERE "ownerId" = ANY($1::text[])`, ids,
    );
    for (const r of rows) {
      if (!map.has(r.ownerId)) map.set(r.ownerId, new Set());
      map.get(r.ownerId)!.add(norm(r.email));
    }
  } catch { /* table absente → vide */ }
  return map;
}

export async function listBlocked(ownerId: string): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT email FROM mail_blocked_senders WHERE "ownerId" = $1 ORDER BY "createdAt" DESC`, ownerId,
    );
    return rows.map(r => r.email);
  } catch { return []; }
}

export async function addBlocked(ownerId: string, email: string): Promise<void> {
  const e = norm(email);
  if (!ownerId || !e) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO mail_blocked_senders (id, "ownerId", email) VALUES ($1, $2, $3)
       ON CONFLICT ("ownerId", email) DO NOTHING`,
    randomUUID(), ownerId, e,
  ).catch(() => {});
}

export async function removeBlocked(ownerId: string, email: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM mail_blocked_senders WHERE "ownerId" = $1 AND email = $2`, ownerId, norm(email),
  ).catch(() => {});
}
