import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { canAccessIcsGed } from "@/lib/ics";
import { getValidGedToken } from "@/lib/ics-ged-auth";
import { gedFindDocuments } from "@/lib/ics-ged";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Outils disponibles pour Auguste ─────────────────────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_tasks",
    description: "Récupère la liste des tâches. Peut filtrer par statut, priorité, ou assigné.",
    input_schema: {
      type: "object" as const,
      properties: {
        status:     { type: "string", enum: ["todo","inprogress","review","done"] },
        priority:   { type: "string", enum: ["urgent","haute","moyenne","basse"] },
        assigneeId: { type: "string", description: "Filtrer par ID utilisateur assigné" },
      },
    },
  },
  {
    name: "create_task",
    description: "Crée une nouvelle tâche dans le logiciel. N'appelle cet outil QUE si tu as un titre clair. Sinon demande-le.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:       { type: "string",  description: "Titre de la tâche (OBLIGATOIRE — ne pas inventer)" },
        description: { type: "string",  description: "Description détaillée" },
        status:      { type: "string",  enum: ["todo","inprogress","review","done"] },
        priority:    { type: "string",  enum: ["urgent","haute","moyenne","basse"] },
        assigneeId:  { type: "string",  description: "ID exact de l'utilisateur à assigner (obtenu via get_users)" },
        dueDate:     { type: "string",  description: "Date d'échéance YYYY-MM-DD" },
        tags:        { type: "array",   items: { type: "string" } },
        familyId:    { type: "string" },
        groupId:     { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Modifie une tâche existante.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:          { type: "string", description: "ID de la tâche (obtenu via get_tasks)" },
        title:       { type: "string" },
        description: { type: "string" },
        status:      { type: "string", enum: ["todo","inprogress","review","done"] },
        priority:    { type: "string", enum: ["urgent","haute","moyenne","basse"] },
        assigneeId:  { type: "string" },
        dueDate:     { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "get_calendar_events",
    description: "Récupère les événements de l'agenda.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "Date début ISO" },
        to:   { type: "string", description: "Date fin ISO" },
      },
    },
  },
  {
    name: "create_calendar_event",
    description: "Crée un rendez-vous ou événement dans l'agenda. N'appelle cet outil QUE si tu as une date ET une heure précises. Sinon demande-les.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:       { type: "string",  description: "Titre (OBLIGATOIRE)" },
        start:       { type: "string",  description: "Début ISO ex: 2026-06-25T14:00:00 (OBLIGATOIRE — calculer depuis la date du jour fournie en contexte)" },
        end:         { type: "string",  description: "Fin ISO. Si non précisé: start + 1h pour RDV, + 2h pour visite/EDL" },
        description: { type: "string" },
        location:    { type: "string",  description: "Lieu ou adresse" },
        type:        { type: "string",  enum: ["rdv","visite","edl","signature","formation","autre"] },
        color:       { type: "string",  description: "Couleur hex" },
        allDay:      { type: "boolean" },
        attendees:   {
          type: "array",
          description: "Participants — utiliser type='user' avec l'ID exact si membre de l'agence",
          items: {
            type: "object",
            properties: {
              type:  { type: "string", enum: ["user","contact"] },
              id:    { type: "string" },
              name:  { type: "string" },
              email: { type: "string" },
            },
          },
        },
      },
      required: ["title", "start"],
    },
  },
  {
    name: "update_calendar_event",
    description: "Modifie un événement agenda existant.",
    input_schema: {
      type: "object" as const,
      properties: {
        id:          { type: "string", description: "ID de l'événement" },
        title:       { type: "string" },
        start:       { type: "string" },
        end:         { type: "string" },
        location:    { type: "string" },
        description: { type: "string" },
        type:        { type: "string", enum: ["rdv","visite","edl","signature","formation","autre"] },
      },
      required: ["id"],
    },
  },
  {
    name: "get_users",
    description: "Récupère la liste des utilisateurs actifs. Appelle cet outil avant d'assigner une tâche ou inviter à un événement.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_task_families",
    description: "Récupère les familles et groupes de tâches disponibles.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_notifications",
    description: "Récupère les notifications non lues de l'utilisateur connecté.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_channels",
    description: "Récupère les conversations de messagerie interne.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "send_internal_message",
    description: "Envoie un message interne dans un channel.",
    input_schema: {
      type: "object" as const,
      properties: {
        channelId: { type: "string" },
        content:   { type: "string" },
      },
      required: ["channelId","content"],
    },
  },
  {
    name: "search_mail",
    description: "Recherche dans les emails de l'utilisateur courant (uniquement sa propre messagerie). Utile pour retrouver une information, un expéditeur, un objet ou un échange.",
    input_schema: {
      type: "object" as const,
      properties: {
        query:  { type: "string", description: "Mots-clés à chercher dans l'objet, l'expéditeur ou le contenu." },
        from:   { type: "string", description: "Filtrer par adresse/expéditeur (optionnel)." },
        limit:  { type: "number", description: "Nombre max de résultats (défaut 15)." },
      },
    },
  },
  {
    name: "recherche_documents_ics",
    description: "Recherche dans la GED ICS les documents d'un propriétaire ou locataire (quittances, baux, avis d'échéance, mandats, factures…). Donne le nom du tiers. Réservé à la direction et à la gestion locative.",
    input_schema: {
      type: "object" as const,
      properties: {
        nom: { type: "string", description: "Nom du propriétaire ou du locataire à rechercher (ex. « TOUCHET », « Dupont »)." },
      },
      required: ["nom"],
    },
  },
  {
    name: "noter_terme",
    description: "Mémorise un terme technique/métier et sa signification, pour s'en souvenir lors des prochaines demandes. À utiliser quand l'utilisateur explique un terme propre à l'agence ou au métier (ex. un sigle, une référence interne, un raccourci de langage).",
    input_schema: {
      type: "object" as const,
      properties: {
        terme:       { type: "string", description: "Le terme ou sigle à mémoriser." },
        signification: { type: "string", description: "Sa signification / définition / contexte d'usage." },
      },
      required: ["terme", "signification"],
    },
  },
];

// ── Exécution des outils ─────────────────────────────────────
interface SideEffect {
  type: string;
  id:   string;
  title: string;
  detail?: string;
}

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: string,
  sideEffects: SideEffect[],
  userRole: string = "user",
) {
  // Cloisonnement d'Auguste : admin et direction voient tout ; un agent ne
  // consulte que ses propres données.
  const seeAll = userRole === "admin" || userRole === "direction";
  switch (name) {

    case "get_tasks": {
      const where: Record<string, unknown> = {};
      if (input.status)     where.status     = input.status;
      if (input.priority)   where.priority   = input.priority;
      if (!seeAll) {
        // Agent : uniquement ses tâches (assignées ou créées)
        where.OR = [{ assigneeId: userId }, { createdById: userId }];
      } else if (input.assigneeId) {
        where.assigneeId = input.assigneeId;
      }
      const tasks = await prisma.task.findMany({
        where,
        include: { assignee: { select: { id: true, prenom: true, nom: true } }, family: true, group: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return tasks.map(t => ({
        id: t.id, title: t.title, status: t.status, priority: t.priority,
        assignee: t.assignee ? `${t.assignee.prenom} ${t.assignee.nom}` : null,
        family: t.family?.name, group: t.group?.name,
        dueDate: t.dueDate?.toISOString().split("T")[0],
        tags: t.tags,
      }));
    }

    case "create_task": {
      if (!input.title) return { error: "Titre manquant — demander à l'utilisateur" };
      const task = await prisma.task.create({
        data: {
          title:       input.title as string,
          description: input.description as string | undefined,
          status:      (input.status  as string) || "todo",
          priority:    (input.priority as string) || "moyenne",
          assigneeId:  input.assigneeId as string | undefined,
          dueDate:     input.dueDate ? new Date(input.dueDate as string) : undefined,
          tags:        (input.tags as string[]) || [],
          familyId:    input.familyId as string | undefined,
          groupId:     input.groupId  as string | undefined,
        },
        include: { assignee: { select: { prenom: true, nom: true } } },
      });
      if (input.assigneeId && input.assigneeId !== userId) {
        await prisma.notification.create({
          data: {
            userId: input.assigneeId as string,
            type: "task",
            title: `Nouvelle tâche : ${task.title}`,
            body: "Assignée par Auguste",
            link: "/taches",
          },
        });
      }
      sideEffects.push({
        type: "task_created",
        id: task.id,
        title: task.title,
        detail: task.assignee ? `Assignée à ${task.assignee.prenom} ${task.assignee.nom}` : undefined,
      });
      return {
        ok: true, id: task.id, title: task.title, status: task.status,
        assignee: task.assignee ? `${task.assignee.prenom} ${task.assignee.nom}` : null,
      };
    }

    case "update_task": {
      const task = await prisma.task.update({
        where: { id: input.id as string },
        data: {
          ...(input.title       !== undefined && { title:       input.title       as string }),
          ...(input.description !== undefined && { description: input.description as string }),
          ...(input.status      !== undefined && { status:      input.status      as string }),
          ...(input.priority    !== undefined && { priority:    input.priority    as string }),
          ...(input.assigneeId  !== undefined && { assigneeId:  input.assigneeId  as string }),
          ...(input.dueDate     !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate as string) : null }),
        },
      });
      sideEffects.push({ type: "task_updated", id: task.id, title: task.title });
      return { ok: true, id: task.id, title: task.title, status: task.status };
    }

    case "get_calendar_events": {
      const calWhere: Record<string, unknown> = {};
      if (input.from) calWhere.start = { gte: new Date(input.from as string) };
      if (input.to)   calWhere.end   = { lte: new Date(input.to   as string) };
      const allEvents = await prisma.calendarEvent.findMany({
        where: calWhere,
        orderBy: { start: "asc" },
        take: seeAll ? 50 : 200,
      });
      // Agent : seulement les événements qu'il a créés ou auxquels il participe.
      const events = (seeAll ? allEvents : allEvents.filter(e => {
        if (e.createdBy === userId) return true;
        const att = Array.isArray(e.attendees) ? (e.attendees as Array<{ type?: string; id?: string }>) : [];
        return att.some(a => a.type === "user" && a.id === userId);
      })).slice(0, 50);
      return events.map(e => ({
        id: e.id, title: e.title,
        start: e.start.toISOString(), end: e.end.toISOString(),
        location: e.location, type: e.type, attendees: e.attendees,
      }));
    }

    case "create_calendar_event": {
      if (!input.title) return { error: "Titre manquant" };
      if (!input.start) return { error: "Date/heure manquante — demander à l'utilisateur" };

      const startDate = new Date(input.start as string);
      if (isNaN(startDate.getTime())) return { error: "Date invalide" };

      // Fin par défaut selon le type
      let endDate: Date;
      if (input.end) {
        endDate = new Date(input.end as string);
      } else {
        const type = (input.type as string) || "rdv";
        const duration = ["visite","edl"].includes(type) ? 2 * 3600000 : 3600000;
        endDate = new Date(startDate.getTime() + duration);
      }

      // ── Vérification des conflits ────────────────────────────
      const conflicts = await prisma.calendarEvent.findMany({
        where: {
          OR: [
            { start: { gte: startDate, lt: endDate } },
            { end:   { gt: startDate, lte: endDate } },
            { start: { lte: startDate }, end: { gte: endDate } },
          ],
        },
        select: { id: true, title: true, start: true, end: true, location: true, type: true },
      });

      const event = await prisma.calendarEvent.create({
        data: {
          title:       input.title as string,
          description: input.description as string | undefined,
          location:    input.location as string | undefined,
          start:       startDate,
          end:         endDate,
          allDay:      !!(input.allDay),
          color:       (input.color as string) || "#B8966A",
          type:        (input.type  as string) || "autre",
          createdBy:   userId,
          attendees:   input.attendees ?? undefined,
        },
      });

      // Notifications aux participants
      const atts = (input.attendees as { type?: string; id?: string; name: string }[]) || [];
      for (const a of atts.filter(x => x.type === "user" && x.id && x.id !== userId)) {
        await prisma.notification.create({
          data: {
            userId: a.id!,
            type: "calendar",
            title: `Nouvel événement : ${event.title}`,
            body: startDate.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
            link: "/planning",
          },
        });
      }

      sideEffects.push({
        type: "event_created",
        id: event.id,
        title: event.title,
        detail: `${startDate.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}${event.location ? ` · ${event.location}` : ""}`,
      });
      return {
        ok: true, id: event.id, title: event.title,
        start: event.start.toISOString(), end: event.end.toISOString(),
        location: event.location, type: event.type,
        conflicts: conflicts.length > 0 ? conflicts.map(c => ({
          id: c.id, title: c.title,
          start: c.start.toISOString(), end: c.end.toISOString(),
          location: c.location, type: c.type,
        })) : [],
        conflictWarning: conflicts.length > 0
          ? `⚠️ ATTENTION : ${conflicts.length} événement(s) déjà prévu(s) sur ce créneau : ${conflicts.map(c => `"${c.title}" (${c.start.toLocaleString("fr-FR", {dateStyle:"short",timeStyle:"short"})})`).join(", ")}. L'événement a été créé mais signale ce conflit à l'utilisateur.`
          : null,
      };
    }

    case "update_calendar_event": {
      const evtData: Record<string, unknown> = {};
      if (input.title)       evtData.title       = input.title;
      if (input.description) evtData.description = input.description;
      if (input.location)    evtData.location    = input.location;
      if (input.type)        evtData.type        = input.type;
      if (input.start)       evtData.start       = new Date(input.start as string);
      if (input.end)         evtData.end         = new Date(input.end   as string);
      const event = await prisma.calendarEvent.update({
        where: { id: input.id as string },
        data: evtData,
      });
      sideEffects.push({ type: "event_updated", id: event.id, title: event.title });
      return { ok: true, id: event.id, title: event.title };
    }

    case "get_users": {
      const users = await prisma.user.findMany({
        where: { active: true },
        select: { id: true, prenom: true, nom: true, email: true, roleId: true },
      });
      return users.map(u => ({ id: u.id, name: `${u.prenom} ${u.nom}`, email: u.email, role: u.roleId }));
    }

    case "get_task_families": {
      const families = await prisma.taskFamily.findMany({
        include: { groups: true },
        orderBy: { order: "asc" },
      });
      return families.map(f => ({
        id: f.id, name: f.name, color: f.color,
        groups: f.groups.map(g => ({ id: g.id, name: g.name })),
      }));
    }

    case "get_notifications": {
      const notifs = await prisma.notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return notifs.map(n => ({ id: n.id, type: n.type, title: n.title, body: n.body, createdAt: n.createdAt.toISOString() }));
    }

    case "get_channels": {
      const memberships = await prisma.channelMember.findMany({
        where: { userId },
        include: {
          channel: {
            include: {
              members: { include: { user: { select: { id: true, prenom: true, nom: true } } } },
            },
          },
        },
      });
      return memberships.map(m => ({
        id: m.channel.id,
        name: m.channel.name,
        isDirect: m.channel.isDirect,
        members: m.channel.members.map(mb => ({ id: mb.user.id, name: `${mb.user.prenom} ${mb.user.nom}` })),
      }));
    }

    case "send_internal_message": {
      const membership = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: input.channelId as string, userId } },
      });
      if (!membership) return { error: "Accès refusé à ce channel" };
      const msg = await prisma.internalMessage.create({
        data: {
          channelId: input.channelId as string,
          senderId:  userId,
          content:   input.content as string,
          readBy:    [userId],
        },
      });
      const others = await prisma.channelMember.findMany({
        where: { channelId: input.channelId as string, userId: { not: userId } },
      });
      for (const o of others) {
        await prisma.notification.create({
          data: {
            userId: o.userId, type: "message",
            title: "Message d'Auguste",
            body: (input.content as string).slice(0, 80),
            link: "/messagerie-interne",
          },
        });
      }
      sideEffects.push({ type: "message_sent", id: msg.id, title: input.content as string });
      return { ok: true, messageId: msg.id };
    }

    case "search_mail": {
      // Cloisonnement strict : Auguste ne lit QUE la messagerie de l'utilisateur
      // courant (comptes dont il est l'agent, ou messages qui lui sont rattachés),
      // quel que soit son rôle.
      const configs = await prisma.mailAccountConfig.findMany({ where: { sharedUserIds: { has: userId } }, select: { id: true } });
      const allowed = configs.map(c => c.id);
      const q = (input.query as string | undefined)?.trim();
      const from = (input.from as string | undefined)?.trim();
      const limit = Math.min(Number(input.limit) || 25, 60);
      // Recherche large : on remonte jusqu'à 24 mois.
      const since = new Date(); since.setMonth(since.getMonth() - 24);

      const where: Record<string, unknown> = {
        date: { gte: since },
        OR: [{ accountId: { in: allowed } }, { ownerId: userId }],
      };
      const and: Record<string, unknown>[] = [];
      if (q) {
        // Recherche large : chaque mot-clé peut matcher objet / expéditeur / corps / destinataire.
        const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
        for (const term of terms) and.push({ OR: [
          { subject:   { contains: term, mode: "insensitive" } },
          { fromName:  { contains: term, mode: "insensitive" } },
          { fromEmail: { contains: term, mode: "insensitive" } },
          { toEmail:   { contains: term, mode: "insensitive" } },
          { bodyText:  { contains: term, mode: "insensitive" } },
        ] });
      }
      if (from) and.push({ fromEmail: { contains: from, mode: "insensitive" } });
      if (and.length) where.AND = and;

      const mails = await prisma.emailMessage.findMany({
        where, orderBy: { date: "desc" }, take: limit,
        select: { threadId: true, subject: true, fromName: true, fromEmail: true, toEmail: true, date: true, bodyText: true, folder: true },
      });
      return {
        instructions: "Présente chaque mail trouvé sous forme de lien Markdown cliquable [objet](lien) avec la date et l'expéditeur. Les liens ouvrent le mail dans la messagerie.",
        resultats: mails.map(m => ({
          objet: m.subject,
          de: m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail,
          a: m.toEmail,
          date: m.date.toISOString().split("T")[0],
          dossier: m.folder,
          lien: `/messagerie?mail=${encodeURIComponent(m.threadId || "")}`,
          extrait: (m.bodyText || "").replace(/\s+/g, " ").slice(0, 280),
        })),
      };
    }

    case "recherche_documents_ics": {
      if (!canAccessIcsGed(userRole)) return { error: "Accès aux documents ICS réservé à la direction et à la gestion locative." };
      const nom = (input.nom as string | undefined)?.trim();
      if (!nom) return { error: "Précisez le nom du propriétaire ou locataire." };
      const tk = await getValidGedToken();
      if (!tk.token) return { error: tk.error ?? "Accès GED indisponible." };
      const { folders, docs } = await gedFindDocuments(tk.apiBase, tk.token, nom, 25);
      return {
        instructions: "Présente chaque document sous forme de lien Markdown cliquable [nom du document](lien). Les liens ouvrent le PDF directement. Si aucun document, propose d'ouvrir le dossier dans le Drive ICS.",
        dossiers: folders.map(f => f.nom),
        documents: docs.map(d => ({
          nom: d.nom,
          dossier: d.dossier,
          lien: `/api/ics/ged/file?emplacement=${encodeURIComponent(d.emplacement)}&guid=${encodeURIComponent(d.guid)}&name=${encodeURIComponent(d.nom)}`,
        })),
      };
    }

    case "noter_terme": {
      const terme = (input.terme as string | undefined)?.trim();
      const signification = (input.signification as string | undefined)?.trim();
      if (!terme || !signification) return { error: "Terme et signification requis." };
      const key = terme.toLowerCase();
      await prisma.augusteTerm.upsert({
        where: { term: key },
        create: { term: key, definition: signification },
        update: { definition: signification, occurrences: { increment: 1 }, lastUsed: new Date() },
      });
      return { ok: true, message: `Terme « ${terme} » mémorisé.` };
    }

    default:
      return { error: `Outil inconnu: ${name}` };
  }
}

// ── Route principale ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { messages, today } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0)
    return NextResponse.json({ error: "Messages requis" }, { status: 400 });

  const userId   = session.user.id;
  const userName = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
  const userRole = session.user.roleId ?? "user";
  const todayStr = today || new Date().toISOString().split("T")[0];

  // Mémoire d'Auguste : glossaire des termes techniques appris.
  const terms = await prisma.augusteTerm.findMany({ orderBy: { lastUsed: "desc" }, take: 60, select: { term: true, definition: true } });
  const glossaire = terms.length
    ? `\n\n══ MÉMOIRE — TERMES TECHNIQUES DE L'AGENCE ══\nTu as appris et mémorisé ces termes ; utilise-les pour comprendre les demandes :\n${terms.map((t: { term: string; definition: string | null }) => `- ${t.term} : ${t.definition}`).join("\n")}\nQuand l'utilisateur t'explique un NOUVEAU terme/sigle métier, appelle noter_terme pour t'en souvenir durablement.`
    : `\n\nQuand l'utilisateur t'explique un terme/sigle métier propre à l'agence, appelle l'outil noter_terme pour le mémoriser durablement.`;
  const gedCap = canAccessIcsGed(userRole)
    ? "\n- Documents ICS (GED) : retrouver les documents d'un propriétaire/locataire (quittances, baux, mandats…) via recherche_documents_ics"
    : "";

  const SYSTEM = `Tu es Auguste, l'assistant IA de l'agence immobilière Lotier Immobilier.
Tu aides les collaborateurs à gérer leur travail quotidien depuis la plateforme Collab.

Utilisateur connecté : ${userName} (rôle: ${userRole})
Date du jour : ${todayStr} — utilise cette date pour calculer les dates relatives ("demain", "vendredi", "la semaine prochaine", etc.)

Tu as accès aux données réelles et peux agir directement sur le logiciel :
- Tâches : lire, créer, modifier
- Agenda / RDV : lire, créer, modifier
- Messagerie interne : lire, envoyer
- Utilisateurs : consulter la liste
- Notifications : consulter${gedCap}

══ RÈGLES DE CRÉATION (TRÈS IMPORTANTES) ══

AVANT de créer une tâche, vérifie que tu as :
✓ Un titre clair et précis → sinon DEMANDE : "Quel titre pour cette tâche ?"
✓ L'assigné (optionnel) → si mentionné, appelle get_users pour trouver l'ID exact
✓ La priorité (optionnel, défaut: moyenne)
✓ L'échéance (optionnel)

AVANT de créer un rendez-vous/événement, vérifie que tu as :
✓ Un titre → sinon DEMANDE
✓ Une DATE et une HEURE précises → sinon DEMANDE : "Pour quelle date et à quelle heure ?"
  - Calcule les dates relatives depuis ${todayStr}
  - "demain" = le lendemain de ${todayStr}
  - "vendredi" = le prochain vendredi
✓ Un lieu (optionnel, demande si type=visite ou edl)
✓ Les participants (optionnel) → si mentionnés, trouve leur ID via get_users

NE JAMAIS créer avec des données inventées ou incorrectes.
Si une info est ambiguë, DEMANDE avant d'agir.
Si plusieurs infos manquent, pose-les toutes en une seule question.

══ CONFLITS D'AGENDA ══
Quand tu crées un événement, le système retourne un champ "conflictWarning" et "conflicts".
Si conflictWarning n'est pas null, tu DOIS le signaler clairement dans ta réponse après la confirmation de création.
Format : "⚠️ **Conflit détecté** : [liste des événements qui se chevauchent]. L'événement a quand même été créé."

══ APRÈS CRÉATION ══
Confirme toujours clairement ce qui a été fait, par exemple :
- "✅ Tâche créée : **Appeler le locataire Dupont** · Priorité : urgente · Assignée à Marie"
- "📅 Rendez-vous créé : **Visite rue des Lilas** · Vendredi 27 juin à 14h · Lieu : 12 rue des Lilas"

══ TON ET STYLE ══
- Réponds en français, concis et professionnel
- Utilise du markdown (gras **texte**, listes)
- Pour les questions légales : base-toi sur la loi française, indique si ta connaissance est limitée à août 2025${glossaire}`;

  const sideEffects: SideEffect[] = [];
  const toolsUsed: string[] = [];

  const apiMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let finalText = "";

  // Boucle agentic — jusqu'à 6 cycles
  for (let cycle = 0; cycle < 6; cycle++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      tools: TOOLS,
      messages: apiMessages,
    });

    if (response.stop_reason !== "tool_use") {
      finalText = response.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("");
      break;
    }

    const assistantContent = response.content;
    apiMessages.push({ role: "assistant", content: assistantContent });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of assistantContent) {
      if (block.type !== "tool_use") continue;
      toolsUsed.push(block.name);
      const result = await executeTool(
        block.name,
        block.input as Record<string, unknown>,
        userId,
        sideEffects,
        userRole,
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    apiMessages.push({ role: "user", content: toolResults });
  }

  // Journalise la demande (audit admin) — best-effort, ne bloque pas la réponse
  const lastUser = [...(messages as { role: string; content: string }[])].reverse().find(m => m.role === "user")?.content ?? "";
  prisma.augusteLog.create({
    data: {
      userId,
      userName: userName || "—",
      question: String(lastUser).slice(0, 2000),
      reply: finalText.slice(0, 4000),
      tools: [...new Set(toolsUsed)],
    },
  }).catch(() => {});

  return NextResponse.json({ reply: finalText, sideEffects });
}
