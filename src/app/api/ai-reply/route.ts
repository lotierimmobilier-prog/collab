import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { threadContext, subject, tone, instruction, apiKey } = await req.json();

  if (!apiKey) {
    return NextResponse.json({ error: "Clé API Anthropic manquante" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `Tu es un assistant de messagerie professionnel pour une agence immobilière.
Tu rédiges des réponses en français, adaptées au contexte immobilier.
Tu prends en compte l'historique complet des échanges pour assurer la cohérence.
Le ton souhaité est : ${tone ?? "professionnel"}.
${instruction ? `Instruction spécifique : ${instruction}` : ""}
Génère uniquement le corps du message, sans formule d'en-tête ni signature.`;

  const userPrompt = `Sujet : ${subject}

Historique de l'échange :
${threadContext}

Rédige une réponse appropriée.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ reply: text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur IA";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
