// Veille juridique : récupération et analyse de flux RSS/Atom.
import { augusteText, normalizeError, MODELS } from "@/lib/auguste";

export interface FeedItem { title: string; link: string; date: string; summary: string }

function decode(s: string): string {
  return (s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/\s+/g, " ").trim();
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

// Récupère et parse un flux RSS 2.0 ou Atom. Renvoie les entrées les plus
// récentes (max 15).
export async function fetchFeed(url: string): Promise<FeedItem[]> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const resp = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Collab-Veille/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const xml = await resp.text();
    const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    const items: FeedItem[] = blocks.slice(0, 15).map(b => {
      // Atom : le lien est dans un attribut href
      let link = tag(b, "link");
      if (!link) { const lm = b.match(/<link[^>]*href=["']([^"']+)["']/i); if (lm) link = lm[1]; }
      const date = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
      const summary = (tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 500);
      return { title: tag(b, "title"), link, date, summary };
    }).filter(i => i.title);
    return items;
  } finally {
    clearTimeout(to);
  }
}

// Analyse d'un flux par Auguste : synthèse orientée agence immobilière.
export async function analyzeFeed(title: string, items: FeedItem[]): Promise<string> {
  if (!items.length) return "";
  const list = items.slice(0, 12).map((it, i) => `${i + 1}. ${it.title}${it.summary ? ` — ${it.summary.slice(0, 300)}` : ""}`).join("\n");
  try {
    return await augusteText({
      model: MODELS.smart,
      max_tokens: 900,
      system: "Tu es le juriste-veilleur de l'agence immobilière Lotier Immobilier. Tu fais une veille juridique claire et concise en français.",
      messages: [{ role: "user", content: `Voici les dernières publications du flux « ${title} » :\n\n${list}\n\nRédige une synthèse de veille pour une agence immobilière :\n- 3 à 6 points clés (nouveautés, échéances, impacts pratiques pour la gestion locative / transaction / syndic) ;\n- signale ce qui nécessite une action ou une vigilance.\nSois bref et opérationnel. Pas de blabla introductif.` }],
    });
  } catch (e) {
    return `Analyse indisponible : ${normalizeError(e).message}`;
  }
}
