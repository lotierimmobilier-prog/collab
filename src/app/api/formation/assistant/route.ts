import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logAugusteUsage } from "@/lib/auguste-usage";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Auguste « tuteur de formation » : aide le filleul à travailler et à monter
// en compétences sur le métier d'agent immobilier. Pas d'accès aux données
// internes — c'est un assistant pédagogique.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ reply: "L'assistant n'est pas encore disponible. Réessayez plus tard." });
  }

  const { messages } = await req.json().catch(() => ({ messages: [] }));
  const history: Anthropic.MessageParam[] = (Array.isArray(messages) ? messages : [])
    .filter((m: { role?: string; content?: string }) => m?.role && typeof m.content === "string")
    .slice(-12)
    .map((m: { role: string; content: string }) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
  if (history.length === 0) return NextResponse.json({ reply: "Posez-moi votre question sur le métier ou votre formation." });

  // Contexte : le programme de formation (modules + compétences) pour cadrer l'aide.
  let programme = "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modules: any[] = await prisma.trainingModule.findMany({
      where: { active: true }, orderBy: { order: "asc" },
      select: { title: true, competences: { orderBy: { order: "asc" }, select: { title: true } } },
    });
    programme = modules.map(m => `• ${m.title} : ${m.competences.map((c: { title: string }) => c.title).join(", ")}`).join("\n");
  } catch { /* programme indisponible */ }

  const prenom = (session.user as { prenom?: string }).prenom ?? session.user.name?.split(" ")[0] ?? "";
  const SYSTEM = `Tu es Auguste, le tuteur de formation de l'agence Lotier Immobilier. Tu accompagnes ${prenom || "un agent commercial"} en formation par parrainage pour devenir un excellent agent immobilier.
Ton rôle : aider à apprendre et à s'entraîner. Tu expliques clairement les notions du métier (juridique, commercial, estimation, mandats, visites, négociation, déontologie…), tu donnes des exemples concrets de terrain, des astuces, et tu peux proposer des mini-exercices ou questions d'entraînement quand c'est utile.
${programme ? `Programme de formation de l'agence :\n${programme}\n` : ""}
Règles : réponses en français, pédagogiques, structurées et concrètes ; encourageant et bienveillant (vouvoiement). Si une question dépasse la formation (ex. donnée client précise, RH), invite à voir avec son parrain ou l'agence. N'invente pas de chiffres réglementaires : si tu n'es pas sûr, dis-le et recommande de vérifier la source officielle.`;

  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: SYSTEM,
      messages: history,
    });
    const reply = resp.content.filter(b => b.type === "text").map(b => (b as Anthropic.TextBlock).text).join("\n").trim()
      || "Désolé, je n'ai pas pu répondre.";
    logAugusteUsage({ userId: session.user.id, userName: session.user.name, feature: "formation", reply, usage: resp.usage });
    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json({ reply: "L'assistant est momentanément indisponible. Réessayez dans un instant." });
  }
}
