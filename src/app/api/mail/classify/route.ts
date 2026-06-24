import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Tu es Auguste, assistant de l'agence Lotier Immobilier.
Tu analyses des emails et retournes UNIQUEMENT un JSON valide, sans markdown ni texte autour.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { subject, bodyText, fromEmail, fromName, senderType, availableLabels, users } = await req.json();

  // Consulter la mémoire pour cet expéditeur
  const memory = fromEmail
    ? await prisma.mailLabelMemory.findUnique({ where: { fromEmail } })
    : null;

  const labelList = (availableLabels as { id: string; name: string }[])
    .filter(l => !["inbox","sent","trash","spam","starred"].includes(l.id))
    .map(l => `${l.id}: "${l.name}"`)
    .join(", ");

  const userList = (users as { id: string; prenom: string; nom: string }[])
    .map(u => `${u.id}: "${u.prenom} ${u.nom}"`)
    .join(", ");

  const memoryContext = memory
    ? `\nMémoire Auguste : cet expéditeur a déjà été classé avec les libellés [${memory.labelIds.join(", ")}]${memory.assignedToId ? `, assigné à ${memory.assignedToId}` : ""}${memory.note ? `. Note : ${memory.note}` : ""}. Utilise ces informations comme point de départ sauf si le contenu de cet email indique clairement autre chose.`
    : "";

  const prompt = `Analyse cet email et classe-le.

De : ${fromName} <${fromEmail}> (type : ${senderType || "inconnu"})
Objet : ${subject}
Corps : ${(bodyText || "").slice(0, 600)}

Libellés disponibles : ${labelList || "(aucun)"}
Membres de l'équipe disponibles : ${userList || "(aucun)"}${memoryContext}

Réponds en JSON :
{
  "labels": ["id_label1", "id_label2"],
  "assignedToId": "userId_ou_null",
  "priority": "haute|normale|basse",
  "reason": "explication courte en français",
  "fromMemory": true_si_basé_sur_mémoire_sinon_false
}

Règles :
- Choisis 1-3 libellés parmi ceux disponibles (ids exacts)
- assignedToId = null si tu ne sais pas qui doit répondre
- Pour les locataires/propriétaires : privilégie gestionnaire ou directeur
- Pour urgences/impayés : priorité haute`;

  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = resp.content.find(b => b.type === "text")?.text ?? "{}";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(cleaned);
    // Injecter l'info mémoire dans la réponse
    return NextResponse.json({ ...result, hasMemory: !!memory });
  } catch {
    return NextResponse.json({ labels: [], assignedToId: null, priority: "normale", reason: "", hasMemory: false });
  }
}
