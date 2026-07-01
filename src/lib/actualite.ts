// Actualité immobilière : référencement de sites configurés par l'admin.
// Auguste va chercher les articles d'une page, en rédige un résumé court et les
// classe par sujet (gestion, syndic, transaction, divers). Table gérée par
// l'app (SQL brut). Rafraîchi toutes les 24 h.
import { prisma } from "@/lib/prisma";
import { augusteJson, MODELS } from "@/lib/auguste";
import { fetchDecoded } from "@/lib/veille";

export const CATEGORIES = ["gestion", "syndic", "transaction", "divers"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface ActuItem { title: string; summary: string; link: string; date: string; category: Category }

function decode(s: string): string {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, " ").trim();
}

// Extrait les liens (texte + URL absolue) d'une page HTML.
function extractLinks(baseUrl: string, html: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 120) {
    const text = decode(m[2]);
    if (text.length < 18 || text.length > 200) continue;
    let href = m[1];
    try { href = new URL(href, baseUrl).href; } catch { continue; }
    if (!/^https?:/i.test(href) || seen.has(href)) continue;
    seen.add(href);
    out.push({ text, href });
  }
  return out;
}

function normCat(c: string): Category {
  const v = (c || "").toLowerCase();
  if (v.startsWith("gest")) return "gestion";
  if (v.startsWith("synd")) return "syndic";
  if (v.startsWith("trans") || v.includes("vente") || v.includes("achat")) return "transaction";
  return "divers";
}

// Récupère les articles d'un site : fetch HTML → Auguste sélectionne les vrais
// articles, en rédige un résumé court et attribue un sujet.
export async function fetchSourceArticles(url: string): Promise<ActuItem[]> {
  const html = await fetchDecoded(url, "Collab-Actu/1.0", "text/html,application/xhtml+xml,*/*");
  const links = extractLinks(url, html);
  if (!links.length) return [];
  const list = links.slice(0, 80).map((l, i) => `${i}. ${l.text} → ${l.href}`).join("\n");
  const arr = await augusteJson<{ title: string; summary: string; link: string; date?: string; category?: string }[]>({
    model: MODELS.smart,
    max_tokens: 2000,
    system: "Tu extrais les actualités immobilières d'une page web pour une agence. Réponds UNIQUEMENT en JSON.",
    messages: [{ role: "user", content: `Voici les liens de la page ${url} (format « index. texte → url ») :\n\n${list}\n\nSélectionne UNIQUEMENT les liens qui sont de vrais articles / actualités immobilières (pas la navigation, les mentions légales, les catégories, les réseaux sociaux). Pour chacun : un titre propre, un résumé court (1 phrase), la date si visible dans le texte (sinon vide) et un sujet parmi EXACTEMENT : "gestion" (gestion locative), "syndic" (copropriété), "transaction" (vente/achat), "divers". Réponds par un tableau JSON (max 15), du plus pertinent au moins pertinent :\n[{"title":"...","summary":"...","link":"url exacte de la liste","date":"","category":"gestion|syndic|transaction|divers"}]` }],
  }, { fallback: [] });
  const valid = new Set(links.map(l => l.href));
  return (Array.isArray(arr) ? arr : [])
    .filter(a => a && a.link && valid.has(a.link))
    .slice(0, 15)
    .map(a => ({ title: (a.title || "").slice(0, 200), summary: (a.summary || "").slice(0, 300), link: a.link, date: (a.date || "").slice(0, 40), category: normCat(a.category || "") }));
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
