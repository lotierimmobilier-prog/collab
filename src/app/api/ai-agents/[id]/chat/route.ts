import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { augusteText, AugusteError, normalizeError } from "@/lib/auguste";
import { resolveModel, agentAllowed, retrieveContext } from "@/lib/ai-agents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

interface Msg { role: "user" | "assistant"; content: string }

// POST /api/ai-agents/[id]/chat — discuter avec un assistant spécialisé.
// body : { messages: [{ role, content }] }
// L'agent répond à partir de son prompt système + de sa base de connaissance
// (RAG). Il n'accède PAS aux données de l'agence.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = session.user.roleId ?? "";
  const { id } = await ctx.params;

  const agent = await prisma.aiAgent.findUnique({ where: { id } }).catch(() => null) as Any;
  if (!agent || !agent.active) return NextResponse.json({ error: "Assistant introuvable." }, { status: 404 });
  if (!agentAllowed(agent.accessRoles, role)) return NextResponse.json({ error: "Accès non autorisé." }, { status: 403 });

  let body: { messages?: Msg[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const messages = (body.messages || [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 8000) }))
    .slice(-12);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Message manquant." }, { status: 400 });
  }

  // Recherche dans la base de connaissance à partir du dernier message.
  const query = messages[messages.length - 1].content;
  const context = await retrieveContext(id, query).catch(() => "");

  const system = [
    agent.systemPrompt || "Tu es un assistant spécialisé d'une agence immobilière. Réponds en français.",
    context
      ? `\n\n# Base de connaissance de l'agence\nUtilise en priorité ces informations internes quand elles sont pertinentes. Si elles ne répondent pas à la question, appuie-toi sur tes connaissances générales en le signalant.\n\n"""\n${context}\n"""`
      : "",
  ].join("");

  try {
    const reply = await augusteText({
      model: resolveModel(agent.model),
      max_tokens: 1500,
      system,
      messages,
    });
    return NextResponse.json({ reply, usedKnowledge: !!context });
  } catch (err) {
    const e = err instanceof AugusteError ? err : normalizeError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
