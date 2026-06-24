import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Tu es Auguste, l'assistant IA de l'agence Lotier Immobilier.
Tu analyses des emails professionnels immobiliers et proposes des actions concrètes.
Réponds TOUJOURS en JSON valide, sans markdown, sans texte autour.
Sois concis et professionnel. Langue : français.`;

interface MailMsg {
  from: { name: string; email: string };
  subject: string;
  bodyText?: string;
  date: string;
}

function buildThreadContext(messages: MailMsg[]): string {
  return messages.map(m =>
    `[${new Date(m.date).toLocaleDateString("fr-FR")}] De: ${m.from.name} <${m.from.email}>\nObjet: ${m.subject}\n${(m.bodyText || "").slice(0, 800)}`
  ).join("\n\n---\n\n");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { action, messages, threadSubject, senderEmail, tone = "professionnel", instruction = "" } = await req.json();
  const ctx = buildThreadContext(messages || []);

  if (action === "summarize") {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 512, system: SYSTEM,
      messages: [{ role: "user", content: `Résume cet échange email en 3-5 points clés. Contexte immobilier.\n\n${ctx}\n\nRéponds en JSON: {"summary": "...", "points": ["...", "..."]}` }],
    });
    const text = resp.content.find(b => b.type === "text")?.text ?? "{}";
    return NextResponse.json(JSON.parse(text));
  }

  if (action === "draft_reply") {
    const toneLabel: Record<string, string> = { professionnel: "professionnel et bienveillant", cordial: "cordial et chaleureux", formel: "formel et sobre", concis: "concis, aller à l'essentiel" };
    const instrPart = instruction ? `\nInstruction supplémentaire : ${instruction}` : "";
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 1200, system: SYSTEM,
      messages: [{ role: "user", content: `Rédige une réponse à cet email. Ton : ${toneLabel[tone] ?? "professionnel et bienveillant"}. Agence immobilière Lotier Immobilier.${instrPart}\n\n${ctx}\n\nRéponds UNIQUEMENT en JSON valide sans markdown :\n{"reply": "texte de la reponse", "subject": "Re: ${threadSubject}"}` }],
    });
    const raw = resp.content.find(b => b.type === "text")?.text ?? "";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      return NextResponse.json(JSON.parse(cleaned));
    } catch {
      // Si JSON invalide, retourner le texte brut comme réponse
      return NextResponse.json({ reply: cleaned, subject: `Re: ${threadSubject}` });
    }
  }

  if (action === "create_task") {
    // Récupérer les utilisateurs pour l'assignation
    const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true, email: true } });
    const usersStr = users.map(u => `${u.id}|${u.prenom} ${u.nom}`).join(", ");

    const resp = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 600, system: SYSTEM,
      messages: [{ role: "user", content: `À partir de cet email, extrais la tâche à faire. Utilisateurs disponibles: ${usersStr}.\n\n${ctx}\n\nRéponds en JSON: {"title": "...", "description": "...", "priority": "urgente|haute|moyenne|basse", "assigneeId": "...", "assigneeName": "...", "dueDate": "YYYY-MM-DD ou null", "confidence": 0.0-1.0}` }],
    });
    const text = resp.content.find(b => b.type === "text")?.text ?? "{}";
    return NextResponse.json(JSON.parse(text));
  }

  if (action === "detect_rdv") {
    const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true } });
    const usersStr = users.map(u => `${u.id}|${u.prenom} ${u.nom}`).join(", ");

    const resp = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 600, system: SYSTEM,
      messages: [{ role: "user", content: `Détecte tout rendez-vous ou réunion mentionné dans cet email. Utilisateurs de l'agence: ${usersStr}.\n\n${ctx}\n\nRéponds en JSON: {"found": true/false, "title": "...", "start": "ISO datetime ou null", "end": "ISO datetime ou null", "location": "...", "type": "rdv|visite|edl|signature|formation|autre", "attendeeId": "ID utilisateur si reconnu ou null", "attendeeName": "...", "confidence": 0.0-1.0}` }],
    });
    const text = resp.content.find(b => b.type === "text")?.text ?? "{}";
    return NextResponse.json(JSON.parse(text));
  }

  if (action === "identify_sender") {
    if (!senderEmail) return NextResponse.json({ senderType: "unknown" });

    const email = senderEmail.toLowerCase();
    const [user, owner, tenant] = await Promise.all([
      prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, prenom: true, nom: true, roleId: true } }),
      prisma.owner.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, prenom: true, nom: true } }),
      prisma.tenant.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, prenom: true, nom: true } }),
    ]);

    if (user)   return NextResponse.json({ senderType: "user",   senderId: user.id,   name: `${user.prenom} ${user.nom}`,   role: user.roleId });
    if (owner)  return NextResponse.json({ senderType: "owner",  senderId: owner.id,  name: `${owner.prenom} ${owner.nom}`, role: "Propriétaire" });
    if (tenant) return NextResponse.json({ senderType: "tenant", senderId: tenant.id, name: `${tenant.prenom} ${tenant.nom}`, role: "Locataire" });
    return NextResponse.json({ senderType: "unknown" });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
