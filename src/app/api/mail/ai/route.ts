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

function safeJson(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try { return JSON.parse(cleaned); } catch { return {}; }
}

function buildThreadContext(messages: MailMsg[]): string {
  return messages.map(m =>
    `[${new Date(m.date).toLocaleDateString("fr-FR")}] De: ${m.from.name} <${m.from.email}>\nObjet: ${m.subject}\n${(m.bodyText || "").slice(0, 800)}`
  ).join("\n\n---\n\n");
}

async function getKnowledge(category?: string): Promise<string> {
  const where = category ? `WHERE active = true AND category = '${category}'` : `WHERE active = true`;
  try {
    const docs = await prisma.knowledgeDoc.findMany({ where: { active: true, ...(category ? { category } : {}) }, select: { title: true, category: true, content: true }, orderBy: { category: "asc" }, take: 8 });
    if (!docs.length) return "";
    return "\n\n--- BASE DE CONNAISSANCE INTERNE ---\n" + docs.map(d => `[${d.category.toUpperCase()}] ${d.title}:\n${d.content.slice(0, 1200)}`).join("\n\n---\n");
  } catch { return ""; }
}

export async function POST(req: NextRequest) {
  try {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { action, messages, threadSubject, senderEmail, tone = "professionnel", instruction = "", question = "" } = await req.json();
  const ctx = buildThreadContext(messages || []);

  if (action === "summarize") {
    // Contexte historique avec cet expéditeur
    const fromEmail = (messages?.[0]?.from?.email || "").toLowerCase();
    let histCtx = "";
    if (fromEmail) {
      const past = await prisma.emailMessage.findMany({
        where: { OR: [{ fromEmail: { equals: fromEmail, mode: "insensitive" } }, { toEmail: { contains: fromEmail, mode: "insensitive" } }] },
        orderBy: { date: "desc" }, take: 10,
        select: { fromEmail: true, fromName: true, subject: true, bodyText: true, date: true },
      });
      if (past.length > 1) histCtx = `\n\n--- HISTORIQUE (${past.length} échanges précédents avec cet expéditeur) ---\n` + past.slice(1).map(m => `[${new Date(m.date).toLocaleDateString("fr-FR")}] ${m.fromName ?? m.fromEmail} — ${m.subject}: ${(m.bodyText || "").slice(0, 300)}`).join("\n");
    }
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 700, system: SYSTEM,
      messages: [{ role: "user", content: `Résume cet échange email en 3-5 points clés. Si l'historique est disponible, mentionne les éléments importants des échanges passés.\n\n${ctx}${histCtx}\n\nRéponds en JSON: {"summary": "...", "points": ["...", "..."]}` }],
    });
    const text = resp.content.find(b => b.type === "text")?.text ?? "{}";
    return NextResponse.json(safeJson(text));
  }

  if (action === "draft_reply") {
    const toneLabel: Record<string, string> = { professionnel: "professionnel et bienveillant", cordial: "cordial et chaleureux", formel: "formel et sobre", concis: "concis, aller à l'essentiel" };
    const instrPart = instruction ? `\nInstruction supplémentaire : ${instruction}` : "";
    const kb = await getKnowledge();

    // Contexte historique — optionnel, ne bloque pas si erreur
    const fromEmail = ((messages as {from?:{email?:string}}[])?.[0]?.from?.email || "").toLowerCase();
    let histCtx = "";
    if (fromEmail) {
      try {
        const past = await prisma.emailMessage.findMany({
          where: { OR: [{ fromEmail: { equals: fromEmail, mode: "insensitive" } }, { toEmail: { contains: fromEmail, mode: "insensitive" } }] },
          orderBy: { date: "desc" }, take: 5,
          select: { fromEmail: true, fromName: true, subject: true, bodyText: true, date: true },
        });
        if (past.length > 0) {
          histCtx = `\n\n--- HISTORIQUE (${past.length} échanges précédents) ---\n` +
            past.map(m => `[${new Date(m.date).toLocaleDateString("fr-FR")}] ${m.fromName ?? m.fromEmail} — ${m.subject}: ${(m.bodyText || "").slice(0, 200)}`).join("\n");
        }
      } catch { /* historique indisponible, on continue sans */ }
    }

    const prompt = `Rédige une réponse à cet email. Ton : ${toneLabel[tone] ?? "professionnel et bienveillant"}. Agence Lotier Immobilier.${instrPart}${kb}${histCtx}\n\n${ctx}\n\nRéponds UNIQUEMENT en JSON valide :\n{"reply":"texte","subject":"Re: ${threadSubject}"}`;

    const resp = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 1200, system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = resp.content.find(b => b.type === "text")?.text ?? "";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      return NextResponse.json(JSON.parse(cleaned));
    } catch {
      return NextResponse.json({ reply: cleaned, subject: `Re: ${threadSubject}` });
    }
  }

  if (action === "research") {
    // Recherche web + emails précédents
    const searchQuery = question || `${threadSubject} immobilier`;
    const fromEmail2  = (messages?.[0]?.from?.email || "").toLowerCase();

    // Chercher les anciens mails en parallèle
    const pastMails = fromEmail2 ? await prisma.emailMessage.findMany({
      where: { OR: [{ fromEmail: { equals: fromEmail2, mode: "insensitive" } }, { toEmail: { contains: fromEmail2, mode: "insensitive" } }] },
      orderBy: { date: "desc" }, take: 15,
      select: { fromEmail: true, fromName: true, subject: true, bodyText: true, date: true },
    }) : [];

    const mailHistory = pastMails.length > 0
      ? `\n\n--- HISTORIQUE EMAILS (${pastMails.length} mails avec cet expéditeur) ---\n` + pastMails.map(m => `[${new Date(m.date).toLocaleDateString("fr-FR")}] ${m.fromName ?? m.fromEmail} — ${m.subject}: ${(m.bodyText || "").slice(0, 500)}`).join("\n---\n")
      : "";

    // Recherche web avec l'outil natif Anthropic
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 } as any],
      system: `Tu es Auguste, assistant expert en immobilier français pour l'agence Lotier Immobilier. Tu effectues des recherches pertinentes pour aider à répondre aux emails.`,
      messages: [{ role: "user", content: `Recherche des informations sur: "${searchQuery}".\n\nContexte de l'email :\n${ctx}${mailHistory}\n\nSynthétise les résultats de ta recherche web ET les éléments de l'historique des emails. Réponds en JSON valide :\n{"summary":"résumé des informations trouvées (web + historique)","webSources":["titre source 1 — url1","titre source 2 — url2"],"mailInsights":["info clé email 1","info clé email 2"],"keyPoints":["point important 1","point important 2"],"suggestion":"comment utiliser ces infos dans la réponse à cet email"}` }],
    });

    // Extraire le texte (le modèle inclut les résultats de recherche dans sa réponse finale)
    const text = resp.content.filter(b => b.type === "text").map(b => (b as { type: "text"; text: string }).text).join("");
    return NextResponse.json(safeJson(text));
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
    return NextResponse.json(safeJson(text));
  }

  if (action === "detect_rdv") {
    const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true } });
    const usersStr = users.map(u => `${u.id}|${u.prenom} ${u.nom}`).join(", ");

    const resp = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 600, system: SYSTEM,
      messages: [{ role: "user", content: `Détecte tout rendez-vous ou réunion mentionné dans cet email. Utilisateurs de l'agence: ${usersStr}.\n\n${ctx}\n\nRéponds en JSON: {"found": true/false, "title": "...", "start": "ISO datetime ou null", "end": "ISO datetime ou null", "location": "...", "type": "rdv|visite|edl|signature|formation|autre", "attendeeId": "ID utilisateur si reconnu ou null", "attendeeName": "...", "confidence": 0.0-1.0}` }],
    });
    const text = resp.content.find(b => b.type === "text")?.text ?? "{}";
    return NextResponse.json(safeJson(text));
  }

  if (action === "full_analysis") {
    // Récupère tous les mails échangés avec cet expéditeur (envoyés et reçus) depuis la DB
    if (!senderEmail) return NextResponse.json({ error: "senderEmail requis" }, { status: 400 });
    const allMsgs = await prisma.emailMessage.findMany({
      where: { OR: [
        { fromEmail: { equals: senderEmail, mode: "insensitive" } },
        { toEmail:   { contains: senderEmail, mode: "insensitive" } },
      ]},
      orderBy: { date: "asc" },
      take: 80,
      select: { fromEmail: true, fromName: true, toEmail: true, subject: true, bodyText: true, date: true },
    });

    const histCtx = allMsgs.map(m =>
      `[${new Date(m.date).toLocaleDateString("fr-FR")}] De: ${m.fromName ?? m.fromEmail} → À: ${m.toEmail}\nObjet: ${m.subject}\n${(m.bodyText || "").slice(0, 600)}`
    ).join("\n\n---\n\n");

    const resp = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 1600, system: SYSTEM,
      messages: [{ role: "user", content: `Fais un bilan complet de tous les échanges avec ${senderEmail} (${allMsgs.length} emails). Contexte : agence immobilière Lotier Immobilier.\n\n${histCtx}\n\nRéponds UNIQUEMENT en JSON valide :\n{"name":"nom complet du contact","totalEmails":0,"firstContact":"date","lastContact":"date","summary":"résumé global en 2-3 phrases","topics":["sujet1","sujet2"],"actions":["action à faire 1","action à faire 2"],"sentiment":"positif|neutre|négatif","priority":"haute|normale|basse","notes":"observations importantes"}` }],
    });
    const raw = resp.content.find(b => b.type === "text")?.text ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      return NextResponse.json({ ...JSON.parse(cleaned), totalInDb: allMsgs.length });
    } catch {
      return NextResponse.json({ error: "Analyse impossible", raw: cleaned }, { status: 500 });
    }
  }

  if (action === "classify_thread") {
    // Récupérer les agents actifs pour l'assignation
    const activeUsers = await prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true, roleId: true } });
    const usersStr = activeUsers.map(u => `${u.id}: ${u.prenom} ${u.nom} (${u.roleId ?? "agent"})`).join(", ");
    const ctx = (messages ?? []).map((m: { from: string; subject: string; body: string }) => `De: ${m.from}\nSujet: ${m.subject}\nCorps: ${m.body}`).join("\n---\n");

    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Classifie cet email et détermine qui doit y répondre.\n\nAgents disponibles: ${usersStr}\n\nEmail:\n${ctx}\n\nRéponds UNIQUEMENT en JSON valide: {"label":"locataire|propriétaire|commercial|comptabilité|juridique|technique|autre","assigneeId":"id de l'agent le plus approprié ou null","reason":"raison en 5 mots max"}`,
      }],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw2 = (resp.content.find((b: any) => b.type === "text") as any)?.text ?? "";
    const cleaned2 = raw2.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    try {
      return NextResponse.json(JSON.parse(cleaned2));
    } catch {
      return NextResponse.json({ label: "autre", assigneeId: null });
    }
  }

  if (action === "legal_advice") {
    const q: string = question || "Analyse les aspects juridiques de cet échange.";
    const kb = await getKnowledge("juridique");
    const prompt = `Tu es Auguste, expert juridique immobilier français (loi Alur, loi du 6 juillet 1989, loi Hoguet, Code civil, CCH).${kb}
Contexte de l'échange email :
${ctx}

Question posée : ${q || "Analyse les aspects juridiques de cet échange."}

Réponds en JSON valide uniquement :
{"answer":"analyse juridique claire et précise en 3-5 phrases","articles":["Article ou loi 1","Article ou loi 2"],"warnings":["Point d'attention 1","Point d'attention 2"],"suggestion":"formulation prête à intégrer dans un email professionnel (1-2 phrases)"}`;

    const resp = await client.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 1000, system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const raw = resp.content.find(b => b.type === "text")?.text ?? "{}";
    return NextResponse.json(safeJson(raw));
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[mail/ai] Erreur:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
