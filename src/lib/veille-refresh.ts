// Rafraîchissement automatique de tous les flux de veille (déclenché chaque
// nuit à minuit par le planificateur serveur — voir src/instrumentation.ts).
import { prisma } from "@/lib/prisma";
import { fetchFeed, analyzeFeed } from "@/lib/veille";

// Récupère et ré-analyse tous les flux, puis persiste chaque résultat.
export async function refreshAllFeeds(): Promise<{ refreshed: number; errors: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feeds = (await prisma.$queryRawUnsafe(`SELECT id, title, url FROM veille_feed`).catch(() => [])) as any[];
  let refreshed = 0, errors = 0;
  for (const f of feeds) {
    try {
      const items = await fetchFeed(f.url);
      const analysis = await analyzeFeed(f.title, items);
      await prisma.$executeRawUnsafe(
        `UPDATE veille_feed SET items = $1::jsonb, analysis = $2, "lastAnalyzedAt" = CURRENT_TIMESTAMP, "lastError" = NULL WHERE id = $3`,
        JSON.stringify(items), analysis, f.id,
      );
      refreshed++;
    } catch (e) {
      errors++;
      await prisma.$executeRawUnsafe(
        `UPDATE veille_feed SET "lastError" = $1, "lastAnalyzedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
        e instanceof Error ? e.message : String(e), f.id,
      ).catch(() => {});
    }
  }
  return { refreshed, errors };
}
