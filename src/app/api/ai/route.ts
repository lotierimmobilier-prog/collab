import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Tu es Auguste, l'assistant IA de l'agence immobilière Lotier Immobilier.
Tu aides les collaborateurs à trouver des informations, rédiger des documents, analyser des situations et répondre à leurs questions professionnelles.

Domaines d'expertise :
- Immobilier (location, vente, gestion locative, états des lieux, baux)
- Comptabilité immobilière (charges, TVA, quittances, régularisations)
- Droit immobilier français (loi Alur, décrets, obligations bailleur/locataire)
- Communication professionnelle (rédaction d'e-mails, courriers, comptes-rendus)
- Utilisation de la plateforme Collab (planning, tâches, messagerie)

Règles de comportement :
1. Sois concis et précis — max 3 paragraphes sauf si on te demande plus
2. Si tu n'es pas sûr d'une information légale ou réglementaire, dis-le clairement ("Je vous recommande de vérifier avec un professionnel juridique")
3. N'invente jamais de textes de loi ou de jurisprudences — cite uniquement ce que tu connais avec certitude
4. Pour les chiffres (plafonds, taux, délais légaux), indique toujours la date de ta connaissance (cutoff août 2025)
5. Réponds toujours en français
6. Tutoyez les utilisateurs de façon conviviale mais professionnelle`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { messages } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0)
    return NextResponse.json({ error: "Messages requis" }, { status: 400 });

  const apiMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM,
    messages: apiMessages,
  });

  const text = response.content.find(b => b.type === "text")?.text ?? "";
  return NextResponse.json({ reply: text });
}
