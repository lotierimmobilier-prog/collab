import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/voice/refine — corrige/normalise une instruction DICTÉE (parole →
// texte) pour qu'elle soit précise avant d'être envoyée à Auguste : ponctuation,
// majuscules, chiffres, erreurs de reconnaissance vocale courantes, sans changer
// le sens ni répondre à la demande.
//   body: { text }  → { text: <corrigé> }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.text === "string" ? body.text.trim() : "";
  if (!raw) return NextResponse.json({ text: "" });

  // Sans clé IA on renvoie le texte tel quel (la dictée reste utilisable).
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ text: raw });

  const system = [
    "Tu corriges une instruction DICTÉE à la voix, en français, destinée à un assistant immobilier (agence Lotier Immobilier).",
    "Objectif : rendre le texte PRÉCIS et exploitable, sans en changer le sens ni y répondre.",
    "Règles :",
    "- Corrige la ponctuation, les majuscules, les accents et les fautes évidentes.",
    "- Convertis les nombres dits en lettres en chiffres (ex. « quatorze heures » → « 14h », « deux cents euros » → « 200 € »).",
    "- Corrige les erreurs probables de reconnaissance vocale (mots mal transcrits, noms propres, adresses) en restant fidèle à l'intention.",
    "- Garde la langue française et le ton d'origine. Ne rajoute aucune information inventée.",
    "- Réponds UNIQUEMENT par le texte corrigé, sans guillemets, sans préfixe, sans commentaire.",
  ].join("\n");

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: raw }],
    });
    const out = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join(" ")
      .trim();
    return NextResponse.json({ text: out || raw });
  } catch {
    // En cas d'échec IA, on n'empêche pas l'usage : on renvoie le texte brut.
    return NextResponse.json({ text: raw });
  }
}
