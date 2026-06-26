import { prisma } from "@/lib/prisma";

// Colonnes « utilisateur » susceptibles de manquer encore en base + leur type.
const USER_COLUMNS: Record<string, string> = {
  parrainId: "TEXT",
  gedAccess: "TEXT",
  accessOverrides: "JSONB",
  avatar: "TEXT",
  lastLogin: "TIMESTAMP(3)",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function missingColumn(err: any): string | null {
  const s = String(err);
  if (!/does not exist/i.test(s)) return null;
  const m = s.match(/column `?(\w+)`? of relation/i) || s.match(/column "?(\w+)"? .* does not exist/i);
  return m ? m[1] : null;
}

// Écriture utilisateur (create/update) résiliente au décalage de schéma :
// si une colonne récente manque encore en base, on l'AJOUTE directement
// (ALTER via la connexion Prisma — fiable, sans lecture de fichier) puis on
// rejoue l'écriture AVEC les données (parrain, gedAccess… réellement
// persistés). Si l'ajout est impossible (droits), on retire la colonne en
// dernier recours pour ne pas bloquer le reste de la fiche.
export async function saveUser<T extends object>(
  write: () => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): Promise<T> {
  const triedAlter = new Set<string>();
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      return await write();
    } catch (err) {
      const col = missingColumn(err);
      if (!col) throw err;
      if (!triedAlter.has(col)) {
        // 1ʳᵉ rencontre de cette colonne → on tente de l'ajouter.
        triedAlter.add(col);
        try {
          await prisma.$executeRawUnsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS "${col}" ${USER_COLUMNS[col] ?? "TEXT"}`);
        } catch { /* refus possible (droits) → on stripera au tour suivant */ }
      } else if (col in data) {
        // Déjà tenté d'ajouter, toujours absente → on retire ce champ.
        delete data[col];
      } else {
        throw err;
      }
    }
  }
  return await write();
}
