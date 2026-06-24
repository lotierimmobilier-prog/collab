import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Définition des outils disponibles pour Auguste ──────────
const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_tasks",
    description: "Récupère la liste des tâches. Peut filtrer par statut, priorité, ou assigné.",
    input_schema: {
      type: "object" as const,
      properties: {
        status:   { type: "string", enum: ["todo","inprogress","review","done"], description: "Filtrer par statut" },
        priority: { type: "string", enum: ["urgent","haute","moyenne","basse"], description: "Filtrer par priorité" },
        assigneeId: { type: "string", description: "Filtrer par ID utilisateur assigné" },
      },
    },
  },
  {
    name: "create_task",
    description: "Crée une nouvelle tâche et l'assigne à un utilisateur.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:       { type: "string",  description: "Titre de la tâche (obligatoire)" },
        description: { type: "string",  description: "Description détaillée" },
        status:      { type: "string",  enum: ["todo","inprogress","review","done"], description: "Statut initial (défaut: todo)" },
        priority:    { type: "string",  enum: ["urgent","haute","moyenne","basse"],  description: "Priorité (défaut: moyenne)" },
        assigneeId:  { type: "string",  description: "ID de l'utilisateur à assigner" },
        dueDate:     { type: "string",  description: "Date d'échéance format YYYY-MM-DD" },
        tags:        { type: "array", items: { type: "string" }, description: "Étiquettes" },
        familyId:    { type: "string",  description: "ID de la famille de tâches" },
        groupId:     { type: "string",  description: "ID du groupe de tâches" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Modifie une tâche existante (statut, priorité, assigné, etc.).",
    input_schema: {
      type: "object" as const,
      properties: {
        id:          { type: "string", description: "ID de la tâche" },
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
    description: "Récupère les événements de l'agenda pour une période donnée.",
    input_schema: {
      type: "object" as const,
      properties: {
        from: { type: "string", description: "Date début ISO (ex: 2026-06-01)" },
        to:   { type: "string", description: "Date fin ISO (ex: 2026-06-30)" },
      },
    },
  },
  {
    name: "create_calendar_event",
    description: "Crée un événement dans l'agenda avec possibilité d'inviter des participants.",
    input_schema: {
      type: "object" as const,
      properties: {
        title:       { type: "string",  description: "Titre de l'événement (obligatoire)" },
        start:       { type: "string",  description: "Date/heure début ISO ex: 2026-06-25T14:00:00" },
        end:         { type: "string",  description: "Date/heure fin ISO" },
        description: { type: "string",  description: "Description" },
        location:    { type: "string",  description: "Lieu" },
        type:        { type: "string",  enum: ["rdv","visite","edl","signature","formation","autre"] },
        color:       { type: "string",  description: "Couleur hex ex: #B8966A" },
        allDay:      { type: "boolean", description: "Toute la journée ?" },
        attendees:   {
          type: "array",
          description: "Participants à inviter",
          items: {
            type: "object",
            properties: {
              type:  { type: "string", enum: ["user","contact"] },
              id:    { type: "string", description: "ID utilisateur si type=user" },
              name:  { type: "string" },
              email: { type: "string" },
            },
          },
        },
      },
      required: ["title","start","end"],
    },
  },
  {
    name: "get_users",
    description: "Récupère la liste des utilisateurs actifs de l'agence.",
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
    name: "send_internal_message",
    description: "Envoie un message interne à un utilisateur ou dans un groupe.",
    input_schema: {
      type: "object" as const,
      properties: {
        channelId: { type: "string", description: "ID du channel (obligatoire)" },
        content:   { type: "string", description: "Contenu du message" },
      },
      required: ["channelId","content"],
    },
  },
  {
    name: "get_channels",
    description: "Récupère la liste des conversations et groupes de messagerie interne de l'utilisateur.",
    input_schema: { type: "object" as const, properties: {} },
  },
];

// ── Exécution des outils côté serveur ───────────────────────
async function executeTool(name: string, input: Record<string, unknown>, userId: string, userRole: string) {
  switch (name) {

    case "get_tasks": {
      const where: Record<string, unknown> = {};
      if (input.status)     where.status     = input.status;
      if (input.priority)   where.priority   = input.priority;
      if (input.assigneeId) where.assigneeId = input.assigneeId;
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
      const task = await prisma.task.create({
        data: {
          title:       input.title as string,
          description: input.description as string | undefined,
          status:      (input.status as string)   || "todo",
          priority:    (input.priority as string)  || "moyenne",
          assigneeId:  input.assigneeId as string  | undefined,
          dueDate:     input.dueDate ? new Date(input.dueDate as string) : undefined,
          tags:        (input.tags as string[])    || [],
          familyId:    input.familyId as string    | undefined,
          groupId:     input.groupId as string     | undefined,
        },
      });
      // Notification à l'assigné
      if (input.assigneeId && input.assigneeId !== userId) {
        await prisma.notification.create({
          data: {
            userId: input.assigneeId as string,
            type: "task", title: `Nouvelle tâche : ${input.title}`,
            body: `Assignée par Auguste`, link: "/taches",
          },
        });
      }
      return { ok: true, id: task.id, title: task.title, status: task.status };
    }

    case "update_task": {
      const task = await prisma.task.update({
        where: { id: input.id as string },
        data: {
          ...(input.title       !== undefined && { title: input.title as string }),
          ...(input.description !== undefined && { description: input.description as string }),
          ...(input.status      !== undefined && { status: input.status as string }),
          ...(input.priority    !== undefined && { priority: input.priority as string }),
          ...(input.assigneeId  !== undefined && { assigneeId: input.assigneeId as string }),
          ...(input.dueDate     !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate as string) : null }),
        },
      });
      return { ok: true, id: task.id, title: task.title, status: task.status };
    }

    case "get_calendar_events": {
      const calWhere: Record<string, unknown> = {};
      if (input.from) calWhere.start = { gte: new Date(input.from as string) };
      if (input.to)   calWhere.end   = { lte: new Date(input.to as string) };
      const events = await prisma.calendarEvent.findMany({
        where: calWhere,
        orderBy: { start: "asc" }, take: 50,
      });
      return events.map(e => ({
        id: e.id, title: e.title, start: e.start.toISOString(),
        end: e.end.toISOString(), location: e.location, type: e.type,
        attendees: e.attendees,
      }));
    }

    case "create_calendar_event": {
      const event = await prisma.calendarEvent.create({
        data: {
          title:       input.title as string,
          description: input.description as string | undefined,
          location:    input.location as string    | undefined,
          start:       new Date(input.start as string),
          end:         new Date(input.end as string),
          allDay:      !!(input.allDay),
          color:       (input.color as string) || "#B8966A",
          type:        (input.type as string)  || "autre",
          createdBy:   userId,
          attendees:   input.attendees ?? undefined,
        },
      });
      // Notifications aux utilisateurs mentionnés
      const atts = (input.attendees as { type?: string; id?: string; name: string }[]) || [];
      for (const a of atts.filter(x => x.type === "user" && x.id)) {
        await prisma.notification.create({
          data: {
            userId: a.id!, type: "calendar",
            title: `Nouvel événement : ${input.title}`,
            body: new Date(input.start as string).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }),
            link: "/planning",
          },
        });
      }
      return { ok: true, id: event.id, title: event.title, start: event.start.toISOString() };
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
      return families.map(f => ({ id: f.id, name: f.name, color: f.color, groups: f.groups.map(g => ({ id: g.id, name: g.name })) }));
    }

    case "get_notifications": {
      const notifs = await prisma.notification.findMany({
        where: { userId, read: false },
        orderBy: { createdAt: "desc" }, take: 20,
      });
      return notifs.map(n => ({ id: n.id, type: n.type, title: n.title, body: n.body, createdAt: n.createdAt.toISOString() }));
    }

    case "get_channels": {
      const memberships = await prisma.channelMember.findMany({
        where: { userId },
        include: { channel: { include: { members: { include: { user: { select: { id: true, prenom: true, nom: true } } } } } } },
      });
      return memberships.map(m => ({
        id: m.channel.id, name: m.channel.name, isDirect: m.channel.isDirect,
        members: m.channel.members.map(mb => ({ id: mb.user.id, name: `${mb.user.prenom} ${mb.user.nom}` })),
      }));
    }

    case "send_internal_message": {
      // Vérifier que l'utilisateur est membre
      const membership = await prisma.channelMember.findUnique({
        where: { channelId_userId: { channelId: input.channelId as string, userId } },
      });
      if (!membership) return { error: "Accès refusé à ce channel" };
      const msg = await prisma.internalMessage.create({
        data: { channelId: input.channelId as string, senderId: userId, content: input.content as string, readBy: [userId] },
      });
      // Notifications aux autres membres
      const others = await prisma.channelMember.findMany({ where: { channelId: input.channelId as string, userId: { not: userId } } });
      for (const o of others) {
        await prisma.notification.create({
          data: { userId: o.userId, type: "message", title: "Message d'Auguste", body: (input.content as string).slice(0, 80), link: "/messagerie-interne" },
        });
      }
      return { ok: true, messageId: msg.id };
    }

    default:
      return { error: `Outil inconnu: ${name}` };
  }
}

// ── Route principale ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { messages } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0)
    return NextResponse.json({ error: "Messages requis" }, { status: 400 });

  const userId   = session.user.id;
  const userName = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
  const userRole = session.user.roleId ?? "user";

  const SYSTEM = `Tu es Auguste, l'assistant IA de l'agence immobilière Lotier Immobilier.
Tu aides les collaborateurs de l'agence à gérer leur travail quotidien.

Utilisateur connecté : ${userName} (rôle: ${userRole})

Tu as accès à toutes les données et actions de la plateforme Collab via tes outils :
- Tâches : consulter, créer, modifier
- Agenda : consulter les événements, créer des rendez-vous
- Messagerie interne : lire les conversations, envoyer des messages
- Utilisateurs : voir les membres de l'agence
- Notifications : consulter les alertes non lues

RÈGLES D'ACTION :
1. Utilise tes outils pour répondre aux questions avec des données RÉELLES (pas inventées)
2. Avant de créer/modifier quelque chose, confirme brièvement ce que tu vas faire
3. Si l'utilisateur demande de créer une tâche ou un RDV, utilise directement l'outil
4. Pour les droits : l'utilisateur a le rôle "${userRole}" — respecte les permissions
5. Toujours répondre en français, de façon concise et professionnelle
6. Indique clairement quand une action a été réalisée (ex: "✅ Tâche créée : ...")

Domaines d'expertise : immobilier, baux, gestion locative, loi Alur, comptabilité immobilière.
Pour les questions légales, indique que ta connaissance est arrêtée en août 2025.`;

  // Boucle agentic — jusqu'à 5 cycles d'outils
  const apiMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let finalText = "";

  for (let cycle = 0; cycle < 5; cycle++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM,
      tools: TOOLS,
      messages: apiMessages,
    });

    // Pas d'appel d'outil — réponse finale
    if (response.stop_reason !== "tool_use") {
      finalText = response.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("");
      break;
    }

    // Extraire texte intermédiaire + appels d'outils
    const assistantContent = response.content;
    apiMessages.push({ role: "assistant", content: assistantContent });

    // Exécuter chaque outil
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of assistantContent) {
      if (block.type !== "tool_use") continue;
      const result = await executeTool(block.name, block.input as Record<string, unknown>, userId, userRole);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    apiMessages.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({ reply: finalText });
}
