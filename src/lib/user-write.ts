import { runMigrations } from "@/lib/run-migrations";

// Exécute une écriture utilisateur (create/update) de façon résiliente :
// si une colonne récente manque encore en base, on applique les migrations
// puis on réessaie AVEC les mêmes données (le parrain/gedAccess sont donc bien
// persistés). En dernier recours seulement, on retire la colonne fautive.
export async function saveUser<T extends object>(
  write: () => Promise<T>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any,
): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (!/does not exist|column/i.test(String(err))) throw err;
    // 1) On tente de réparer le schéma puis on rejoue la même écriture.
    try {
      await runMigrations();
      return await write();
    } catch (err2) {
      // 2) Si ça résiste encore, on retire la colonne fautive et on réessaie.
      const m = String(err2).match(/column `?(\w+)`? of relation/i) || String(err2).match(/column "?(\w+)"? .* does not exist/i);
      if (m && data && (m[1] in data)) {
        delete data[m[1]];
        return await write();
      }
      throw err2;
    }
  }
}
