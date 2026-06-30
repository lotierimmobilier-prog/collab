/**
 * Cœur partagé des assistants IA spécialisés.
 * - Mappe le « tier » de modèle choisi par agent vers un modèle Anthropic réel.
 * - Récupère le contexte pertinent dans la base de connaissance (RAG).
 *
 * Génération : Anthropic (cf. lib/auguste.ts). Embeddings : OpenAI (cf.
 * lib/embeddings.ts). Auguste, le généraliste, n'est pas concerné par ce fichier.
 */
import { prisma } from "@/lib/prisma";
import { MODELS } from "@/lib/auguste";
import { embedOne, cosineSim } from "@/lib/embeddings";

// Modèles Anthropic proposés par défaut (clés stables, rétrocompatibles avec
// les anciens « tiers »). La direction peut aussi saisir n'importe quel
// identifiant de modèle Anthropic (ex. un modèle Opus).
export const AGENT_MODELS: { id: string; label: string; hint: string }[] = [
  { id: "fast",  label: "Haiku 4.5",  hint: "Rapide & économique" },
  { id: "smart", label: "Sonnet 4.6", hint: "Équilibré (recommandé)" },
  { id: "fable", label: "Fable 5",    hint: "Créatif" },
];

// Correspondance clé/preset → identifiant de modèle réel.
const MODEL_MAP: Record<string, string> = {
  fast:  MODELS.fast,
  smart: MODELS.smart,
  fable: "claude-fable-5",
  // Ancien tier « qualité max » : identifiant Opus fourni par l'environnement.
  max:   process.env.ANTHROPIC_MODEL_MAX || MODELS.smart,
};

const MODEL_ID_RE = /^claude[-.][a-z0-9.\-]+$/i;

// Modèle valide : preset connu OU identifiant Anthropic explicite.
export function isValidModel(m?: string | null): boolean {
  return !!m && (!!MODEL_MAP[m] || MODEL_ID_RE.test(m));
}

// Étiquette lisible (pour l'affichage admin).
export function modelLabel(m?: string | null): string {
  if (!m) return "Sonnet 4.6";
  const preset = AGENT_MODELS.find(x => x.id === m);
  if (preset) return preset.label;
  if (m === "max") return "Qualité maximale";
  return m;
}

export function resolveModel(model: string | null | undefined): string {
  if (!model) return MODELS.smart;
  if (MODEL_MAP[model]) return MODEL_MAP[model];
  if (MODEL_ID_RE.test(model)) return model; // identifiant Anthropic explicite
  return MODELS.smart;
}

/** Un agent est-il accessible à un utilisateur d'un rôle donné ? */
export function agentAllowed(accessRoles: unknown, role: string): boolean {
  if (!accessRoles || !Array.isArray(accessRoles) || accessRoles.length === 0) return true; // tout le monde
  return (accessRoles as unknown[]).map(String).includes(role);
}

interface ChunkRow { id: string; content: string; embedding: unknown }

/**
 * Récupère les fragments de base de connaissance les plus pertinents pour une
 * requête. Sémantique si des embeddings existent, sinon score par mots-clés.
 * Retourne le texte concaténé (borné) prêt à injecter dans le prompt système.
 */
export async function retrieveContext(agentId: string, query: string, topK = 6, maxChars = 6000): Promise<string> {
  const rows = await prisma.aiAgentChunk.findMany({
    where: { agentId },
    select: { id: true, content: true, embedding: true },
  }).catch(() => []) as ChunkRow[];
  if (!rows.length) return "";

  let ranked: { content: string; score: number }[];

  const qVec = await embedOne(query).catch(() => null);
  const haveVectors = rows.some(r => Array.isArray(r.embedding));

  if (qVec && haveVectors) {
    ranked = rows.map(r => ({
      content: r.content,
      score: Array.isArray(r.embedding) ? cosineSim(qVec, r.embedding as number[]) : -1,
    }));
  } else {
    // Fallback mots-clés : recouvrement de termes (>3 lettres).
    const terms = [...new Set((query.toLowerCase().match(/[a-zà-ÿ0-9]{4,}/gi) || []))];
    ranked = rows.map(r => {
      const c = r.content.toLowerCase();
      const score = terms.reduce((s, t) => s + (c.includes(t) ? 1 : 0), 0);
      return { content: r.content, score };
    });
  }

  const top = ranked.sort((a, b) => b.score - a.score).filter(r => r.score > 0).slice(0, topK);
  let out = "";
  for (const t of top) {
    if (out.length + t.content.length > maxChars) break;
    out += (out ? "\n\n---\n\n" : "") + t.content;
  }
  return out;
}
