import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MODELS, augusteJson, augusteText, extractJson, normalizeError } from "@/lib/auguste";

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

interface ResolvedContact {
  senderType: "user" | "owner" | "tenant" | "unknown";
  senderId?: string;
  name?: string;
  role?: string | null;
}

/** Résout l'identité d'un expéditeur à partir de son email (collègue / propriétaire / locataire). */
async function resolveContact(email?: string): Promise<ResolvedContact> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return { senderType: "unknown" };
  const [user, owner, tenant] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: e, mode: "insensitive" } }, select: { id: true, prenom: true, nom: true, roleId: true } }),
    prisma.owner.findFirst({ where: { email: { equals: e, mode: "insensitive" } }, select: { id: true, prenom: true, nom: true } }),
    prisma.tenant.findFirst({ where: { email: { equals: e, mode: "insensitive" } }, select: { id: true, prenom: true, nom: true } }),
  ]);
  if (user)   return { senderType: "user",   senderId: user.id,   name: `${user.prenom} ${user.nom}`,   role: user.roleId };
  if (owner)  return { senderType: "owner",  senderId: owner.id,  name: `${owner.prenom} ${owner.nom}`,  role: "Propriétaire" };
  if (tenant) return { senderType: "tenant", senderId: tenant.id, name: `${tenant.prenom} ${tenant.nom}`, role: "Locataire" };
  return { senderType: "unknown" };
}

async function getKnowledge(category?: string): Promise<string> {
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

  const { action, messages, threadSubject, senderEmail, tone = "professionnel", instruction = "", question = "", length = "moyen" } = await req.json();
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
    const data = await augusteJson({
      model: MODELS.smart, max_tokens: 700, system: SYSTEM,
      messages: [{ role: "user", content: `Résume cet échange email en 3-5 points clés. Si l'historique est disponible, mentionne les éléments importants des échanges passés.\n\n${ctx}${histCtx}\n\nRéponds en JSON: {"summary": "...", "points": ["...", "..."]}` }],
    }, { fallback: {} });
    return NextResponse.json(data);
  }

  if (action === "draft_reply") {
    const toneLabel: Record<string, string> = { professionnel: "professionnel et bienveillant", cordial: "cordial et chaleureux", formel: "formel et sobre", concis: "concis, aller à l'essentiel" };
    const lengthLabel: Record<string, string> = {
      court: "Réponse courte : 2-3 phrases, va droit au but.",
      moyen: "Réponse de longueur moyenne : 1 paragraphe clair.",
      détaillé: "Réponse détaillée : plusieurs paragraphes couvrant chaque point soulevé.",
    };
    const lengthTokens: Record<string, number> = { court: 600, moyen: 1200, détaillé: 1800 };
    const instrPart = instruction ? `\nInstruction supplémentaire : ${instruction}` : "";
    const lengthPart = `\n${lengthLabel[length] ?? lengthLabel.moyen}`;
    const kb = await getKnowledge();

    // Contexte historique — optionnel, ne bloque pas si erreur
    const fromEmail = ((messages as {from?:{email?:string}}[])?.[0]?.from?.email || "").toLowerCase();

    // Identité du destinataire — permet d'adapter le ton (propriétaire/locataire/collègue)
    let identityPart = "";
    try {
      const contact = await resolveContact(senderEmail || fromEmail);
      if (contact.senderType !== "unknown" && contact.name) {
        const roleLabel = contact.senderType === "user" ? "collègue de l'agence" : (contact.role || contact.senderType);
        identityPart = `\n\nDestinataire identifié : ${contact.name} — ${roleLabel}. Adapte le ton et les formules de politesse en conséquence.`;
      }
    } catch { /* identité indisponible, on continue sans */ }
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

    const prompt = `Rédige une réponse à cet email. Ton : ${toneLabel[tone] ?? "professionnel et bienveillant"}. Agence Lotier Immobilier.${lengthPart}${instrPart}${identityPart}${kb}${histCtx}\n\n${ctx}\n\nRéponds UNIQUEMENT en JSON valide :\n{"reply":"texte","subject":"Re: ${threadSubject}"}`;

    const data = await augusteJson<{ reply?: string; subject?: string }>({
      model: MODELS.smart, max_tokens: lengthTokens[length] ?? 1200, system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }, { fallback: { subject: `Re: ${threadSubject}` } });
    return NextResponse.json(data);
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
    const text = await augusteText({
      model: MODELS.smart,
      max_tokens: 2000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 } as any],
      system: `Tu es Auguste, assistant expert en immobilier français pour l'agence Lotier Immobilier. Tu effectues des recherches pertinentes pour aider à répondre aux emails.`,
      messages: [{ role: "user", content: `Recherche des informations sur: "${searchQuery}".\n\nContexte de l'email :\n${ctx}${mailHistory}\n\nSynthétise les résultats de ta recherche web ET les éléments de l'historique des emails. Réponds en JSON valide :\n{"summary":"résumé des informations trouvées (web + historique)","webSources":["titre source 1 — url1","titre source 2 — url2"],"mailInsights":["info clé email 1","info clé email 2"],"keyPoints":["point important 1","point important 2"],"suggestion":"comment utiliser ces infos dans la réponse à cet email"}` }],
    });
    return NextResponse.json(extractJson(text) ?? {});
  }

  if (action === "create_task") {
    // Récupérer les utilisateurs pour l'assignation
    const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true, email: true } });
    const usersStr = users.map(u => `${u.id}|${u.prenom} ${u.nom}`).join(", ");

    const data = await augusteJson({
      model: MODELS.smart, max_tokens: 600, system: SYSTEM,
      messages: [{ role: "user", content: `À partir de cet email, extrais la tâche à faire. Utilisateurs disponibles: ${usersStr}.\n\n${ctx}\n\nRéponds en JSON: {"title": "...", "description": "...", "priority": "urgente|haute|moyenne|basse", "assigneeId": "...", "assigneeName": "...", "dueDate": "YYYY-MM-DD ou null", "confidence": 0.0-1.0}` }],
    }, { fallback: {} });
    return NextResponse.json(data);
  }

  if (action === "detect_rdv") {
    const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true } });
    const usersStr = users.map(u => `${u.id}|${u.prenom} ${u.nom}`).join(", ");

    const data = await augusteJson({
      model: MODELS.smart, max_tokens: 600, system: SYSTEM,
      messages: [{ role: "user", content: `Détecte tout rendez-vous ou réunion mentionné dans cet email. Utilisateurs de l'agence: ${usersStr}.\n\n${ctx}\n\nRéponds en JSON: {"found": true/false, "title": "...", "start": "ISO datetime ou null", "end": "ISO datetime ou null", "location": "...", "type": "rdv|visite|edl|signature|formation|autre", "attendeeId": "ID utilisateur si reconnu ou null", "attendeeName": "...", "confidence": 0.0-1.0}` }],
    }, { fallback: { found: false } });
    return NextResponse.json(data);
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

    const data = await augusteJson<Record<string, unknown>>({
      model: MODELS.smart, max_tokens: 1600, system: SYSTEM,
      messages: [{ role: "user", content: `Fais un bilan complet de tous les échanges avec ${senderEmail} (${allMsgs.length} emails). Contexte : agence immobilière Lotier Immobilier.\n\n${histCtx}\n\nRéponds UNIQUEMENT en JSON valide :\n{"name":"nom complet du contact","totalEmails":0,"firstContact":"date","lastContact":"date","summary":"résumé global en 2-3 phrases","topics":["sujet1","sujet2"],"actions":["action à faire 1","action à faire 2"],"sentiment":"positif|neutre|négatif","priority":"haute|normale|basse","notes":"observations importantes"}` }],
    });
    return NextResponse.json({ ...data, totalInDb: allMsgs.length });
  }

  if (action === "classify_thread") {
    // Récupérer les agents actifs pour l'assignation
    const activeUsers = await prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true, roleId: true } });
    const usersStr = activeUsers.map(u => `${u.id}: ${u.prenom} ${u.nom} (${u.roleId ?? "agent"})`).join(", ");
    const ctxC = (messages ?? []).map((m: { from: string; subject: string; body: string }) => `De: ${m.from}\nSujet: ${m.subject}\nCorps: ${m.body}`).join("\n---\n");

    const data = await augusteJson<{ label?: string; assigneeId?: string | null; priority?: string; reason?: string }>({
      model: MODELS.fast,
      max_tokens: 220,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Classifie cet email, détermine qui doit y répondre et son niveau de priorité.\n\nAgents disponibles: ${usersStr}\n\nEmail:\n${ctxC}\n\nRéponds UNIQUEMENT en JSON valide: {"label":"locataire|propriétaire|commercial|comptabilité|juridique|technique|autre","assigneeId":"id de l'agent le plus approprié ou null","priority":"haute|normale|basse","reason":"raison en 5 mots max"}\n\nPriorité haute = urgence, impayé, litige, départ/préavis, sinistre, délai légal. Priorité basse = newsletter, publicité, accusé de réception, information sans action.`,
      }],
    }, { fallback: { label: "autre", assigneeId: null, priority: "normale" } });
    return NextResponse.json(data);
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

    const data = await augusteJson({
      model: MODELS.smart, max_tokens: 1000, system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }, { fallback: {} });
    return NextResponse.json(data);
  }

  if (action === "identify_sender") {
    if (!senderEmail) return NextResponse.json({ senderType: "unknown" });
    return NextResponse.json(await resolveContact(senderEmail));
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (err) {
    const e = normalizeError(err);
    console.error("[mail/ai] Erreur:", e.message);
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
}
