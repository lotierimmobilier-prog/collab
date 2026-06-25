import Anthropic from "@anthropic-ai/sdk";

/**
 * Cœur partagé de l'assistant Auguste.
 * Centralise : modèles, client Anthropic, parsing JSON robuste,
 * retries sur erreurs transitoires et messages d'erreur lisibles.
 */

// ── Modèles ────────────────────────────────────────────────────
export const MODELS = {
  /** Raisonnement / rédaction (résumés, brouillons, analyses, juridique) */
  smart: "claude-sonnet-4-6",
  /** Classification rapide / tri (peu coûteux) */
  fast: "claude-haiku-4-5-20251001",
} as const;

// ── Erreur typée ───────────────────────────────────────────────
export class AugusteError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "AugusteError";
    this.status = status;
  }
}

// ── Client (singleton) ─────────────────────────────────────────
let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AugusteError(
      "Clé API Anthropic absente. Renseignez ANTHROPIC_API_KEY côté serveur pour activer Auguste.",
      503,
    );
  }
  if (!_client) _client = new Anthropic({ apiKey });
  return _client;
}

// ── Normalisation des erreurs SDK → message clair ──────────────
export function normalizeError(err: unknown): AugusteError {
  if (err instanceof AugusteError) return err;
  const e = err as { status?: number; message?: string; error?: { message?: string } };
  const status = e?.status ?? 500;
  let msg = e?.error?.message || e?.message || String(err);

  if (status === 401) msg = "Clé API Anthropic invalide ou expirée.";
  else if (status === 400 && /credit|billing/i.test(msg)) msg = "Crédit Anthropic insuffisant.";
  else if (status === 429) msg = "Limite de requêtes IA atteinte, réessayez dans un instant.";
  else if (status === 503 || status === 529) msg = "Service IA momentanément surchargé, réessayez.";

  return new AugusteError(msg, status);
}

// ── Extraction JSON robuste ────────────────────────────────────
/**
 * Extrait un objet/tableau JSON depuis une réponse modèle, même si elle
 * contient du texte autour ou des fences markdown. Retourne null si rien
 * d'exploitable.
 */
export function extractJson<T = Record<string, unknown>>(raw: string): T | null {
  if (!raw) return null;
  const s = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

  // 1) tentative directe
  try { return JSON.parse(s) as T; } catch { /* on poursuit */ }

  // 2) on isole le premier bloc { … } ou [ … ] équilibré
  const candidates: string[] = [];
  const oOpen = s.indexOf("{"), oClose = s.lastIndexOf("}");
  if (oOpen !== -1 && oClose > oOpen) candidates.push(s.slice(oOpen, oClose + 1));
  const aOpen = s.indexOf("["), aClose = s.lastIndexOf("]");
  if (aOpen !== -1 && aClose > aOpen) candidates.push(s.slice(aOpen, aClose + 1));

  for (const c of candidates) {
    try { return JSON.parse(c) as T; } catch { /* candidat suivant */ }
  }
  return null;
}

// ── Concatène les blocs texte d'une réponse ────────────────────
function textOf(resp: Anthropic.Message): string {
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("");
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 529]);

// ── Appel texte avec retries exponentiels sur erreurs transitoires ──
export async function augusteText(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  retries = 2,
): Promise<string> {
  const client = getAnthropic();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await client.messages.create(params);
      return textOf(resp);
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status;
      if (status && !RETRYABLE.has(status)) break;
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 400 * 2 ** attempt));
      }
    }
  }
  throw normalizeError(lastErr);
}

/**
 * Appel renvoyant directement du JSON validé.
 * - retries réseau via augusteText
 * - si le JSON est illisible et qu'un `fallback` est fourni, le retourne
 *   plutôt que de lever une erreur.
 */
export async function augusteJson<T = Record<string, unknown>>(
  params: Anthropic.Messages.MessageCreateParamsNonStreaming,
  opts: { retries?: number; fallback?: T } = {},
): Promise<T> {
  const text = await augusteText(params, opts.retries ?? 2);
  const parsed = extractJson<T>(text);
  if (parsed !== null) return parsed;
  if (opts.fallback !== undefined) return opts.fallback;
  throw new AugusteError("Réponse d'Auguste illisible (JSON invalide).", 502);
}
