import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { augusteText, AugusteError, normalizeError, MODELS } from "@/lib/auguste";
import { resolveModel, agentAllowed, retrieveContext } from "@/lib/ai-agents";

// Analyse de pièces jointes (PDF) : laisser le temps au modèle de répondre.
export const maxDuration = 60;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

interface Att { name?: string; mediaType: string; data?: string; text?: string }
interface Msg { role: "user" | "assistant"; content: string; attachments?: Att[] }

const IMG_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_ATT = 5;
const MAX_ATT_CHARS = 7_500_000; // ~5,6 Mo par fichier binaire (base64)
const MAX_TEXT_CHARS = 400_000;  // ~400 Ko par fichier texte

// POST /api/ai-agents/[id]/chat — discuter avec un assistant spécialisé.
// body : { messages: [{ role, content, attachments?: [{ name, mediaType, data }] }] }
// L'agent répond à partir de son prompt système + de sa base de connaissance
// (RAG) et peut analyser des pièces jointes (PDF, images) de la DERNIÈRE question.
// Il n'accède PAS aux données de l'agence.
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
  const norm = (body.messages || [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: (m.content || "").trim().slice(0, 8000), attachments: m.attachments }))
    .slice(-12);
  if (!norm.length || norm[norm.length - 1].role !== "user") {
    return NextResponse.json({ error: "Message manquant." }, { status: 400 });
  }

  // Pièces jointes : uniquement sur le dernier message (la question courante),
  // pour borner la taille de la requête.
  const isBinaryAtt = (a: Att) => typeof a.data === "string" && a.data.length <= MAX_ATT_CHARS
    && (a.mediaType === "application/pdf" || IMG_TYPES.includes(a.mediaType));
  const isTextAtt = (a: Att) => typeof a.text === "string" && a.text.length > 0 && a.text.length <= MAX_TEXT_CHARS;
  const lastAtts = (norm[norm.length - 1].attachments || [])
    .filter((a) => a && (isBinaryAtt(a) || isTextAtt(a)))
    .slice(0, MAX_ATT);
  const hasPdf = lastAtts.some((a) => a.mediaType === "application/pdf");

  if (!norm[norm.length - 1].content && !lastAtts.length) {
    return NextResponse.json({ error: "Message vide." }, { status: 400 });
  }

  // Recherche dans la base de connaissance (sur le texte de la question).
  const query = norm[norm.length - 1].content || lastAtts.map((a) => a.name).filter(Boolean).join(", ");
  const context = await retrieveContext(id, query).catch(() => "");

  const system = [
    agent.systemPrompt || "Tu es un assistant spécialisé d'une agence immobilière. Réponds en français.",
    "\n\nMise en forme : structure tes réponses en Markdown (titres, listes, gras) de façon claire et professionnelle.",
    context
      ? `\n\n# Base de connaissance de l'agence\nUtilise en priorité ces informations internes quand elles sont pertinentes. Si elles ne répondent pas à la question, appuie-toi sur tes connaissances générales en le signalant.\n\n"""\n${context}\n"""`
      : "",
  ].join("");

  // Construction des messages Anthropic (pièces jointes du dernier message).
  const messages: Anthropic.MessageParam[] = norm.map((m, idx) => {
    const atts = idx === norm.length - 1 ? lastAtts : [];
    if (!atts.length) return { role: m.role, content: m.content };
    const blocks: Anthropic.ContentBlockParam[] = [];
    // Documents binaires (PDF, images) en premier.
    for (const a of atts) {
      if (a.mediaType === "application/pdf" && a.data) {
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } });
      } else if (a.data && IMG_TYPES.includes(a.mediaType)) {
        blocks.push({ type: "image", source: { type: "base64", media_type: a.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: a.data } });
      }
    }
    // Fichiers texte : injectés comme blocs de texte étiquetés.
    for (const a of atts) {
      if (typeof a.text === "string" && a.text) {
        blocks.push({ type: "text", text: `Fichier joint « ${a.name || "document"} » :\n\n"""\n${a.text}\n"""` });
      }
    }
    blocks.push({ type: "text", text: m.content || "Analyse le(s) document(s) ci-joint(s) et donne-moi ton avis." });
    return { role: m.role, content: blocks };
  });

  // Les documents PDF nécessitent un modèle capable ; on évite le tier « rapide ».
  let model = resolveModel(agent.model);
  if (hasPdf && model === MODELS.fast) model = MODELS.smart;

  try {
    const reply = await augusteText({
      model,
      max_tokens: lastAtts.length ? 2200 : 1500,
      system,
      messages,
    });
    return NextResponse.json({ reply, usedKnowledge: !!context });
  } catch (err) {
    const e = err instanceof AugusteError ? err : normalizeError(err);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
