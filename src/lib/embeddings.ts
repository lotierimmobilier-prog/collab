/**
 * Embeddings (OpenAI) pour la recherche sémantique de la base de connaissance
 * des assistants IA. La GÉNÉRATION des réponses reste 100 % Anthropic ; OpenAI
 * ne sert qu'à vectoriser/retrouver les documents.
 *
 * Dégradation gracieuse : si OPENAI_API_KEY est absente, on ne vectorise pas
 * (les fragments sont stockés sans embedding) et la recherche bascule sur un
 * score par mots-clés (voir lib/ai-agents.ts).
 */

const EMBED_MODEL = "text-embedding-3-small"; // 1536 dimensions, économique
const EMBED_URL = "https://api.openai.com/v1/embeddings";

export function embeddingsAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/** Vectorise une liste de textes. Retourne null si indisponible/erreur. */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !texts.length) return null;
  try {
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { data?: { embedding: number[] }[] };
    const vecs = (data.data || []).map(d => d.embedding);
    return vecs.length === texts.length ? vecs : null;
  } catch {
    return null;
  }
}

/** Vectorise un seul texte (requête utilisateur). */
export async function embedOne(text: string): Promise<number[] | null> {
  const v = await embedTexts([text]);
  return v ? v[0] : null;
}

/** Similarité cosinus entre deux vecteurs de même dimension. */
export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Découpe un texte en fragments d'environ `size` caractères, avec un léger
 * recouvrement, en coupant de préférence sur des frontières de paragraphe/phrase.
 */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = (text || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (clean.length <= size) return clean ? [clean] : [];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      // recule jusqu'à une coupure propre (saut de ligne, point, espace)
      const slice = clean.slice(start, end);
      const cut = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf("\n"), slice.lastIndexOf(". "));
      if (cut > size * 0.5) end = start + cut + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}
