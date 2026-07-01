// Veille juridique : récupération et analyse de flux RSS/Atom, OU extraction
// des articles d'un site web classique via Auguste.
import { augusteText, augusteJson, normalizeError, MODELS } from "@/lib/auguste";

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

// Récupère et parse un flux RSS 2.0 ou Atom (max 15). Si l'URL n'est PAS un
// flux mais une page web classique, on bascule sur l'extraction des articles
// par Auguste.
// Détecte l'encodage (en-tête HTTP, puis déclaration XML / meta charset) et
// décode les octets en conséquence. Évite les caractères « � » sur les flux
// encodés en ISO-8859-1 / Windows-1252 (fréquent sur les sites français).
function detectCharset(headerCt: string | null, bytes: Uint8Array): string {
  const ct = (headerCt || "").toLowerCase();
  let m = ct.match(/charset=([^;]+)/);
  if (m) return m[1].trim().replace(/["']/g, "");
  const head = new TextDecoder("ascii").decode(bytes.slice(0, 2048)).toLowerCase();
  m = head.match(/encoding=["']([^"']+)["']/) || head.match(/charset=["']?([\w-]+)/);
  return m ? m[1].trim() : "utf-8";
}

export async function fetchDecoded(url: string, ua = "Collab-Veille/1.0", accept = "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*"): Promise<string> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const resp = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": ua, Accept: accept } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const cs = detectCharset(resp.headers.get("content-type"), bytes);
    try { return new TextDecoder(cs).decode(bytes); }
    catch { return new TextDecoder("utf-8").decode(bytes); }
  } finally {
    clearTimeout(to);
  }
}

export async function fetchFeed(url: string): Promise<FeedItem[]> {
  const body = await fetchDecoded(url);
  const blocks = body.match(/<item[\s\S]*?<\/item>/gi) || body.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  if (blocks.length) {
    return blocks.slice(0, 15).map(b => {
      let link = tag(b, "link");
      if (!link) { const lm = b.match(/<link[^>]*href=["']([^"']+)["']/i); if (lm) link = lm[1]; }
      const date = tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date");
      const summary = (tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 500);
      return { title: tag(b, "title"), link, date, summary };
    }).filter(i => i.title);
  }
  // Pas un flux RSS/Atom → page web : extraction des articles par Auguste.
  return await extractSiteArticles(url, body);
}

// Extrait les liens (texte + URL absolue) d'une page HTML.
function extractLinks(baseUrl: string, html: string): { text: string; href: string }[] {
  const out: { text: string; href: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < 120) {
    const text = decode(m[2]);
    if (text.length < 18 || text.length > 200) continue;      // titres plausibles
    let href = m[1];
    try { href = new URL(href, baseUrl).href; } catch { continue; }
    if (!/^https?:/i.test(href) || seen.has(href)) continue;
    seen.add(href);
    out.push({ text, href });
  }
  return out;
}

// Demande à Auguste de sélectionner les vrais articles/actualités parmi les
// liens d'une page et d'en rédiger un résumé court.
export async function extractSiteArticles(url: string, html: string): Promise<FeedItem[]> {
  const links = extractLinks(url, html);
  if (!links.length) return [];
  const list = links.slice(0, 80).map((l, i) => `${i}. ${l.text} → ${l.href}`).join("\n");
  const arr = await augusteJson<{ title: string; summary: string; link: string }[]>({
    model: MODELS.smart,
    max_tokens: 1500,
    system: "Tu extrais les actualités d'une page web pour une agence immobilière. Réponds UNIQUEMENT en JSON.",
    messages: [{ role: "user", content: `Voici les liens de la page ${url} (format « index. texte → url ») :\n\n${list}\n\nSélectionne UNIQUEMENT les liens qui sont de vrais articles / actualités (pas la navigation, les mentions légales, les catégories, les réseaux sociaux). Pour chacun, donne un titre propre et un résumé court (1 phrase) déduit du titre. Réponds par un tableau JSON (max 12), du plus pertinent au moins pertinent :\n[{"title":"...","summary":"...","link":"url exacte de la liste"}]` }],
  }, { fallback: [] });
  const byHref = new Map(links.map(l => [l.href, l.text]));
  return (Array.isArray(arr) ? arr : [])
    .filter(a => a && a.link && byHref.has(a.link))
    .slice(0, 12)
    .map(a => ({ title: a.title || byHref.get(a.link) || "", link: a.link, date: "", summary: (a.summary || "").slice(0, 300) }));
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
