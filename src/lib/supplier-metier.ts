import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELS, normalizeError, extractJson } from "@/lib/auguste";

// Catégories d'activité (alignées sur la page Fournisseurs / les ODS).
export const SUPPLIER_TYPES = [
  "plomberie", "electricite", "menuiserie", "maconnerie", "peinture",
  "chauffage", "nettoyage", "serrurerie", "jardinage", "autre",
] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

export interface MetierInput {
  name: string;
  address?: string | null;
  email?: string | null;
  siret?: string | null;
  currentMetier?: string | null;
  /** Extraits de mails échangés avec ce fournisseur (objet + début du corps). */
  emailContext?: string[];
}

export interface MetierGuess {
  /** Catégorie large (une des SUPPLIER_TYPES) pour le filtrage ODS. */
  type: SupplierType;
  /** Libellé métier précis (ex. « Chauffagiste / pompe à chaleur »). */
  metier: string;
  /** 0–100 : confiance d'Auguste dans le rattachement. */
  confidence: number;
  /** Justification courte (d'où vient l'info). */
  rationale: string;
  /** URLs consultées par la recherche web. */
  sources: string[];
}

function asType(v: unknown): SupplierType {
  const s = String(v ?? "").toLowerCase().trim();
  return (SUPPLIER_TYPES as readonly string[]).includes(s) ? (s as SupplierType) : "autre";
}

// Détermine le métier d'un fournisseur à partir de son nom (+ adresse, email,
// SIRET, mails échangés) en s'appuyant sur une recherche web. Sert à compléter
// les fiches fournisseurs pour cibler le bon prestataire dans les ODS.
export async function guessSupplierMetier(input: MetierInput): Promise<MetierGuess> {
  const client = getAnthropic();

  const facts: string[] = [`Nom de l'entreprise : ${input.name}`];
  if (input.address) facts.push(`Adresse : ${input.address}`);
  if (input.email) facts.push(`Email : ${input.email}`);
  if (input.siret) facts.push(`SIRET : ${input.siret}`);
  if (input.currentMetier) facts.push(`Métier indiqué (à vérifier/préciser) : ${input.currentMetier}`);
  if (input.emailContext?.length) {
    facts.push(`Extraits de mails échangés avec ce fournisseur :\n- ${input.emailContext.slice(0, 6).join("\n- ")}`);
  }

  const categories = SUPPLIER_TYPES.join(", ");
  const prompt = `Tu aides une agence immobilière (gestion locative + syndic) à classer ses fournisseurs/prestataires du bâtiment.
Détermine le MÉTIER de cette entreprise. Utilise la recherche web (annuaires pro, Pages Jaunes, societe.com, site de l'entreprise, SIRENE) pour confirmer, en t'appuyant sur le nom et l'adresse.

${facts.join("\n")}

Réponds UNIQUEMENT par un objet JSON (aucun texte autour) :
{"type":"<une catégorie>","metier":"<libellé précis>","confidence":<0-100>,"rationale":"<1 phrase : sur quoi tu te bases>"}

Règles :
- "type" doit être EXACTEMENT l'une de : ${categories}.
- Choisis "autre" si l'activité ne correspond à aucune catégorie OU si tu n'es pas sûr (confidence < 40).
- "metier" = libellé court et précis en français (ex. "Chauffagiste — pompe à chaleur", "Électricien", "Société de nettoyage").
- N'invente pas : si la recherche ne donne rien de fiable, mets confidence basse et type "autre".`;

  let resp: Anthropic.Message;
  try {
    resp = await client.messages.create({
      model: MODELS.smart,
      max_tokens: 1500,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    throw normalizeError(err);
  }

  // Texte final (le JSON) + URLs consultées par la recherche web.
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map(b => b.text)
    .join("");
  const sources = collectSources(resp);

  const parsed = extractJson<{ type?: string; metier?: string; confidence?: number; rationale?: string }>(text);
  if (!parsed) {
    return { type: "autre", metier: input.currentMetier || "", confidence: 0, rationale: "Auguste n'a pas pu déterminer le métier.", sources };
  }

  const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));
  return {
    type: asType(parsed.type),
    metier: (parsed.metier || "").toString().trim() || input.currentMetier || "",
    confidence,
    rationale: (parsed.rationale || "").toString().trim(),
    sources,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectSources(resp: Anthropic.Message): string[] {
  const urls = new Set<string>();
  for (const block of resp.content as any[]) {
    if (block?.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r?.url) urls.add(r.url);
      }
    }
  }
  return [...urls].slice(0, 8);
}
