import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClientFromCookie } from "@/lib/client-auth";
import { tenantLoyer, tenantRdv, createTenantRequest } from "@/lib/client-data";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS: Anthropic.Tool[] = [
  {
    name: "situation_loyer",
    description: "Donne la situation de loyer du locataire connecté : solde, statut (à jour / à payer), prochaine échéance et derniers paiements.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "mes_rendez_vous",
    description: "Liste les prochains rendez-vous (visites, états des lieux, signatures…) du locataire connecté.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "creer_demande",
    description: "Crée une demande / signale un problème à l'agence (ex. fuite, panne, question). Utiliser quand le locataire veut signaler quelque chose ou faire une demande.",
    input_schema: {
      type: "object",
      properties: { description: { type: "string", description: "Description claire de la demande ou du problème, telle que formulée par le locataire." } },
      required: ["description"],
    },
  },
];

export async function POST(req: NextRequest) {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ reply: "L'assistant n'est pas encore disponible. Réessayez plus tard." });
  }

  const { messages } = await req.json().catch(() => ({ messages: [] }));
  const history: Anthropic.MessageParam[] = (Array.isArray(messages) ? messages : [])
    .filter((m: { role?: string; content?: string }) => m?.role && typeof m.content === "string")
    .slice(-10)
    .map((m: { role: string; content: string }) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));

  const today = new Date().toLocaleDateString("fr-FR", { dateStyle: "full" });
  const SYSTEM = `Tu es Auguste, l'assistant de l'espace locataire de l'agence Lotier Immobilier.
Date du jour : ${today}.
Tu réponds UNIQUEMENT avec les informations du dossier du locataire connecté : ${client.prenom} ${client.nom} (${client.email}).
Règles STRICTES :
- N'invente jamais de chiffres ni d'informations : utilise les outils pour obtenir les données réelles.
- Tu n'as accès qu'au dossier de CE locataire. Ne mentionne jamais d'autres locataires, de données internes de l'agence, ni d'informations dont tu ne disposes pas.
- Si une question sort de ton périmètre (solde, paiements, rendez-vous, signaler une demande), invite poliment à contacter l'agence.
- Réponses brèves, claires et chaleureuses, en français, tutoiement non — vouvoiement.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function run(name: string, input: any) {
    try {
      if (name === "situation_loyer") return await tenantLoyer(client!.id);
      if (name === "mes_rendez_vous") { const r = await tenantRdv(client!.id, client!.email); return { rendezVous: r, count: r.length }; }
      if (name === "creer_demande") {
        const desc = typeof input?.description === "string" ? input.description.trim() : "";
        if (!desc) return { error: "Description manquante." };
        return await createTenantRequest(client!, desc);
      }
      return { error: "Outil inconnu." };
    } catch { return { error: "Information momentanément indisponible." }; }
  }

  const apiMessages: Anthropic.MessageParam[] = [...history];
  let finalText = "Désolé, je n'ai pas pu répondre.";
  try {
    for (let cycle = 0; cycle < 5; cycle++) {
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM,
        tools: TOOLS,
        messages: apiMessages,
      });
      if (resp.stop_reason !== "tool_use") {
        finalText = resp.content.filter(b => b.type === "text").map(b => (b as Anthropic.TextBlock).text).join("\n").trim() || finalText;
        break;
      }
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type !== "tool_use") continue;
        const result = await run(block.name, block.input);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
      }
      apiMessages.push({ role: "assistant", content: resp.content });
      apiMessages.push({ role: "user", content: toolResults });
    }
  } catch {
    return NextResponse.json({ reply: "L'assistant est momentanément indisponible. Réessayez dans un instant." });
  }

  return NextResponse.json({ reply: finalText });
}
