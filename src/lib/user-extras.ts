// Attributs utilisateur (parrain, ville, statut salarié, GED, surcharges
// d'accès) stockés dans une table annexe possédée par l'application, car le
// tableau « users » peut appartenir à un autre rôle PostgreSQL et refuser les
// ALTER. Cette table est donc la source de vérité pour ces champs.
import { prisma } from "@/lib/prisma";

export interface Extras {
  parrainId: string | null;
  city: string | null;
  isEmployee: boolean;
  gedAccess: string | null;
  superAdmin: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  accessOverrides: any;
}

const FIELDS = ["parrainId", "city", "isEmployee", "gedAccess", "superAdmin", "accessOverrides"] as const;

export async function getExtras(userIds: string[]): Promise<Map<string, Partial<Extras>>> {
  const map = new Map<string, Partial<Extras>>();
  if (!userIds.length) return map;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "userId","parrainId","city","isEmployee","gedAccess","superAdmin","accessOverrides" FROM user_extras WHERE "userId" = ANY($1::text[])`,
      userIds,
    );
    for (const r of rows) map.set(r.userId, r);
  } catch { /* table absente → vide */ }
  return map;
}

export async function getExtra(userId: string): Promise<Partial<Extras> | null> {
  return (await getExtras([userId])).get(userId) ?? null;
}

// Met à jour uniquement les champs fournis (les autres restent inchangés).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function setExtras(userId: string, fields: Record<string, any>): Promise<void> {
  const keys = FIELDS.filter(k => k in fields);
  if (!keys.length) return;
  try {
    await prisma.$executeRawUnsafe(`INSERT INTO user_extras ("userId") VALUES ($1) ON CONFLICT ("userId") DO NOTHING`, userId);
    for (const k of keys) {
      const v = fields[k];
      if (k === "accessOverrides") {
        await prisma.$executeRawUnsafe(`UPDATE user_extras SET "accessOverrides" = $1::jsonb, "updatedAt" = now() WHERE "userId" = $2`, v == null ? null : JSON.stringify(v), userId);
      } else if (k === "isEmployee" || k === "superAdmin") {
        await prisma.$executeRawUnsafe(`UPDATE user_extras SET "${k}" = $1, "updatedAt" = now() WHERE "userId" = $2`, !!v, userId);
      } else {
        await prisma.$executeRawUnsafe(`UPDATE user_extras SET "${k}" = $1, "updatedAt" = now() WHERE "userId" = $2`, (v ?? null) || null, userId);
      }
    }
  } catch { /* best-effort */ }
}

// Identifiants des filleuls d'un parrain (selon la table annexe).
export async function filleulsOf(parrainId: string): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT "userId" FROM user_extras WHERE "parrainId" = $1`, parrainId);
    return rows.map(r => r.userId);
  } catch { return []; }
}

export async function isEmployeeExtra(userId: string): Promise<boolean> {
  const ex = await getExtra(userId);
  return !!ex?.isEmployee;
}

// Identifiants des salariés (statut « employé »).
export async function employeeUserIds(): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT "userId" FROM user_extras WHERE "isEmployee" = true`);
    return rows.map(r => r.userId);
  } catch { return []; }
}

export async function gedAccessExtra(userId: string): Promise<string | null> {
  const ex = await getExtra(userId);
  return ex?.gedAccess ?? null;
}
