import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MODELS, augusteJson, normalizeError } from "@/lib/auguste";
import { historicalHandler } from "@/lib/mailRouting";
import { isCommercialRole } from "@/lib/admin";

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

  const userArr = (users as { id: string; prenom: string; nom: string }[]) || [];

  // Attribution automatique : on exclut les agents commerciaux (négociateurs),
  // à qui l'on n'assigne pas de mail automatiquement. On récupère leur rôle en
  // base (la liste reçue du client n'en contient pas).
  const roleRows = userArr.length
    ? await prisma.user.findMany({ where: { id: { in: userArr.map(u => u.id) } }, select: { id: true, roleId: true } })
    : [];
  const commercialIds = new Set(roleRows.filter(r => isCommercialRole(r.roleId)).map(r => r.id));
  const assignable = userArr.filter(u => !commercialIds.has(u.id));

  const userList = assignable
    .map(u => `${u.id}: "${u.prenom} ${u.nom}"`)
    .join(", ");

  // Traitant historique réel (assignations passées / réponses envoyées), borné
  // aux seuls agents assignables (exclut les commerciaux).
  const validUserIds = new Set(assignable.map(u => u.id));
  const handler = fromEmail ? await historicalHandler(fromEmail, validUserIds) : null;
  const historyContext = handler
    ? `\nHistorique : cet expéditeur est habituellement traité par l'agent ${handler.userId} (${handler.reason}). Assigne-le à cet agent sauf si le contenu impose clairement un autre service.`
    : "";

  const memoryContext = memory
    ? `\nMémoire Auguste : cet expéditeur a déjà été classé avec les libellés [${memory.labelIds.join(", ")}]${memory.assignedToId ? `, assigné à ${memory.assignedToId}` : ""}${memory.note ? `. Note : ${memory.note}` : ""}. Utilise ces informations comme point de départ sauf si le contenu de cet email indique clairement autre chose.`
    : "";

  const prompt = `Analyse cet email et classe-le.

De : ${fromName} <${fromEmail}> (type : ${senderType || "inconnu"})
Objet : ${subject}
Corps : ${(bodyText || "").slice(0, 600)}

Libellés disponibles : ${labelList || "(aucun)"}
Membres de l'équipe disponibles : ${userList || "(aucun)"}${historyContext}${memoryContext}

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
    const result = await augusteJson<Record<string, unknown>>({
      model: MODELS.fast,
      max_tokens: 256,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }, { fallback: { labels: [], assignedToId: null, priority: "normale", reason: "" } });
    // L'historique réel prime sur la proposition du modèle pour le traitant.
    // Sinon, on ne garde l'assignation du modèle que si l'agent est assignable
    // (jamais un agent commercial).
    if (handler) result.assignedToId = handler.userId;
    else if (typeof result.assignedToId === "string" && !validUserIds.has(result.assignedToId)) result.assignedToId = null;
    return NextResponse.json({ ...result, hasMemory: !!memory, fromHistory: !!handler });
  } catch (err) {
    const e = normalizeError(err);
    console.error("[mail/classify] Erreur:", e.message);
    return NextResponse.json({ labels: [], assignedToId: null, priority: "normale", reason: "", hasMemory: false, error: e.message });
  }
}
