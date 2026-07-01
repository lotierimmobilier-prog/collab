// Actualité immobilière : référencement de sites OU de flux RSS configurés par
// l'admin. On récupère les articles (via flux RSS/Atom si l'URL en est un,
// sinon extraction de la page par Auguste), puis Auguste les classe par sujet
// (gestion, syndic, transaction, divers). Table gérée par l'app (SQL brut).
import { prisma } from "@/lib/prisma";
import { augusteJson, MODELS } from "@/lib/auguste";
import { fetchFeed } from "@/lib/veille";

export const CATEGORIES = ["gestion", "syndic", "transaction", "divers"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface ActuItem { title: string; summary: string; link: string; date: string; category: Category }

function normCat(c: string): Category {
  const v = (c || "").toLowerCase();
  if (v.startsWith("gest")) return "gestion";
  if (v.startsWith("synd") || v.includes("copro")) return "syndic";
  if (v.startsWith("trans") || v.includes("vente") || v.includes("achat")) return "transaction";
  return "divers";
}

// Attribue un sujet à chaque article (par lot, aligné sur l'index). En cas
// d'échec d'Auguste, tout passe en « divers » (on ne perd jamais les articles).
async function categorize(items: { title: string; summary: string }[]): Promise<Category[]> {
  if (!items.length) return [];
  const list = items.map((it, i) => `${i}. ${it.title}${it.summary ? ` — ${it.summary.slice(0, 160)}` : ""}`).join("\n");
  const arr = await augusteJson<{ index: number; category: string }[]>({
    model: MODELS.smart,
    max_tokens: 1500,
    system: "Tu classes des actualités immobilières par sujet. Réponds UNIQUEMENT en JSON.",
    messages: [{ role: "user", content: `Classe chaque article dans EXACTEMENT un sujet parmi : "gestion" (gestion locative), "syndic" (copropriété), "transaction" (vente/achat), "divers".\n\n${list}\n\nRéponds par un tableau JSON aligné sur les index : [{"index":0,"category":"gestion|syndic|transaction|divers"}]` }],
  }, { fallback: [] });
  const map = new Map<number, Category>();
  for (const a of (Array.isArray(arr) ? arr : [])) if (a && typeof a.index === "number") map.set(a.index, normCat(a.category || ""));
  return items.map((_, i) => map.get(i) ?? "divers");
}

// Récupère les articles d'une source (flux RSS OU site web) et les classe.
export async function fetchSourceArticles(url: string): Promise<ActuItem[]> {
  const feed = (await fetchFeed(url)).slice(0, 20);
  if (!feed.length) return [];
  const cats = await categorize(feed.map(f => ({ title: f.title, summary: f.summary })));
  return feed.map((f, i) => ({
    title: (f.title || "").slice(0, 200),
    summary: (f.summary || "").slice(0, 300),
    link: f.link,
    date: f.date || "",
    category: cats[i] ?? "divers",
  })).filter(a => a.title);
}

// Rafraîchit toutes les sources d'actualité (déclenché chaque nuit à minuit).
export async function refreshAllSources(): Promise<{ refreshed: number; errors: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sources = (await prisma.$queryRawUnsafe(`SELECT id, label, url FROM actu_source`).catch(() => [])) as any[];
  let refreshed = 0, errors = 0;
  for (const s of sources) {
    try {
      const items = await fetchSourceArticles(s.url);
      await prisma.$executeRawUnsafe(
        `UPDATE actu_source SET items = $1::jsonb, "lastFetchedAt" = CURRENT_TIMESTAMP, "lastError" = NULL WHERE id = $2`,
        JSON.stringify(items), s.id,
      );
      refreshed++;
    } catch (e) {
      errors++;
      await prisma.$executeRawUnsafe(
        `UPDATE actu_source SET "lastError" = $1, "lastFetchedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
        e instanceof Error ? e.message : String(e), s.id,
      ).catch(() => {});
    }
  }
  return { refreshed, errors };
}
