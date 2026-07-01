// Partage de l'annuaire du super admin : le super admin peut autoriser des
// utilisateurs à consulter SES contacts, en plus des leurs. Table gérée par
// l'app (SQL brut, comme la blocklist/allowlist).
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SUPER_ADMIN_EMAIL } from "@/lib/superadmin";

// Identifiants des utilisateurs super admin : l'adresse bootstrap + tout
// utilisateur marqué superAdmin dans user_extras.
export async function superAdminUserIds(): Promise<string[]> {
  const ids = new Set<string>();
  try {
    const boot = await prisma.user.findFirst({ where: { email: { equals: SUPER_ADMIN_EMAIL, mode: "insensitive" } }, select: { id: true } });
    if (boot) ids.add(boot.id);
  } catch { /* ignore */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (await prisma.$queryRawUnsafe(`SELECT "userId" FROM user_extras WHERE "superAdmin" = true`).catch(() => [])) as any[];
    for (const r of rows) if (r.userId) ids.add(r.userId);
  } catch { /* ignore */ }
  return [...ids];
}

// Utilisateurs autorisés à voir l'annuaire du super admin.
export async function sharedUserIds(): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await prisma.$queryRawUnsafe(`SELECT "userId" FROM annuaire_share`).catch(() => [])) as any[];
  return rows.map(r => r.userId).filter(Boolean);
}

export async function isSharedWith(userId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await prisma.$queryRawUnsafe(`SELECT 1 FROM annuaire_share WHERE "userId" = $1 LIMIT 1`, userId).catch(() => [])) as any[];
  return rows.length > 0;
}

export async function addShare(userId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO annuaire_share (id, "userId") VALUES ($1, $2) ON CONFLICT ("userId") DO NOTHING`,
    randomUUID(), userId,
  ).catch(() => {});
}

export async function removeShare(userId: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM annuaire_share WHERE "userId" = $1`, userId).catch(() => {});
}
