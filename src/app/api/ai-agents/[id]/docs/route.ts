import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";
import { chunkText, embedTexts, embeddingsAvailable } from "@/lib/embeddings";

// POST /api/ai-agents/[id]/docs — ajouter un document à la base de connaissance
// (direction). Le texte est découpé en fragments puis vectorisé (si OpenAI
// configuré). body : { name, content }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  const agent = await prisma.aiAgent.findUnique({ where: { id }, select: { id: true } }).catch(() => null);
  if (!agent) return NextResponse.json({ error: "Assistant introuvable." }, { status: 404 });

  let body: { name?: string; content?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const name = (body.name || "").trim().slice(0, 160) || "Document";
  const content = (body.content || "").trim();
  if (content.length < 10) return NextResponse.json({ error: "Contenu trop court." }, { status: 400 });

  const chunks = chunkText(content);
  if (!chunks.length) return NextResponse.json({ error: "Aucun fragment exploitable." }, { status: 400 });

  // Vectorisation (best-effort) : si indisponible, on stocke sans embedding et
  // la recherche basculera en mode mots-clés.
  let vectors: number[][] | null = null;
  if (embeddingsAvailable()) {
    vectors = await embedTexts(chunks).catch(() => null);
  }

  const doc = await prisma.aiAgentDoc.create({
    data: { agentId: id, name, chars: content.length },
  }).catch(() => null);
  if (!doc) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });

  await prisma.aiAgentChunk.createMany({
    data: chunks.map((c, i) => ({
      agentId: id,
      docId: doc.id,
      idx: i,
      content: c,
      embedding: vectors ? vectors[i] : undefined,
    })),
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: doc.id, chunks: chunks.length, embedded: !!vectors });
}
