import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendNotificationEmail, userEmail } from "@/lib/notify-mail";

const ASSIGNEE_COLORS = ["#B8966A","#059669","#2563EB","#7C3AED","#DC2626","#D97706"];
function colorForId(id: string) {
  return ASSIGNEE_COLORS[id.charCodeAt(0) % ASSIGNEE_COLORS.length];
}

function formatTask(t: {
  id: string; title: string; description: string | null; status: string;
  priority: string; assigneeName: string | null; dueDate: Date | null;
  tags: string[]; project: string | null; createdAt: Date; updatedAt: Date;
  completedAt?: Date | null; completedById?: string | null;
  assignee?: { id: string; prenom: string; nom: string } | null;
  family?: { id: string; name: string; color: string } | null;
  group?: { id: string; name: string } | null;
  familyId?: string | null; groupId?: string | null;
}) {
  const a = t.assignee;
  return {
    ...t,
    assignee:         a ? `${a.prenom} ${a.nom}` : (t.assigneeName ?? undefined),
    assigneeId:       a?.id ?? undefined,
    assigneeInitials: a ? (a.prenom[0] + a.nom[0]).toUpperCase() : undefined,
    assigneeColor:    a ? colorForId(a.id) : undefined,
    dueDate:          t.dueDate?.toISOString().split("T")[0] ?? undefined,
    completedAt:      t.completedAt?.toISOString() ?? undefined,
    completedById:    t.completedById ?? undefined,
    createdAt:        t.createdAt.toISOString(),
    updatedAt:        t.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Cloisonnement : par défaut, chacun (même le super admin) ne voit que les
  // tâches qui LUI sont attribuées. Le paramètre ?scope=all affiche les tâches
  // de tout le monde (bouton « voir toutes les tâches »).
  const uid = session.user.id;
  const seeAll = req.nextUrl.searchParams.get("scope") === "all";
  const scope = seeAll ? {} : { assigneeId: uid };

  // Filtre de statut optionnel : ?status=todo,in_progress (ex. tableau de bord).
  const statusParam = req.nextUrl.searchParams.get("status");
  const statuses = statusParam ? statusParam.split(",").map(s => s.trim()).filter(Boolean) : [];
  const where = statuses.length ? { AND: [scope, { status: { in: statuses } }] } : scope;

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      assignee: { select: { id: true, prenom: true, nom: true } },
      family:   { select: { id: true, name: true, color: true } },
      group:    { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(tasks.map(formatTask));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { title, description, status, priority, assigneeId, assigneeName, dueDate, tags, project, familyId, groupId, recurrence } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Titre requis" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      title:       title.trim(),
      description: description || null,
      status:      status   || "todo",
      priority:    priority || "moyenne",
      assigneeId:  assigneeId   || null,
      assigneeName: assigneeName || null,
      dueDate:     dueDate ? new Date(dueDate) : null,
      tags:        tags    || [],
      project:     project || null,
      familyId:    familyId || null,
      groupId:     groupId  || null,
      recurrence:  recurrence || null,
      createdById: session.user.id,
      ...(status === "done" ? { completedAt: new Date(), completedById: session.user.id } : {}),
    },
    include: {
      assignee: { select: { id: true, prenom: true, nom: true } },
      family:   { select: { id: true, name: true, color: true } },
      group:    { select: { id: true, name: true } },
    },
  });

  if (assigneeId && assigneeId !== session.user.id) {
    await prisma.notification.create({
      data: {
        userId: assigneeId,
        type: "task",
        title: "Nouvelle tâche assignée",
        body: title.trim(),
        link: "/taches",
      },
    });
    // Notification par email à l'agent assigné — EN TÂCHE DE FOND (ne bloque
    // pas la réponse sur l'envoi SMTP).
    after(async () => {
      try {
        const u = await userEmail(assigneeId);
        if (!u) return;
        const echeance = dueDate ? `\nÉchéance : ${new Date(dueDate).toLocaleDateString("fr-FR")}` : "";
        await sendNotificationEmail({
          to: u.email,
          subject: `Nouvelle tâche : ${title.trim()}`,
          heading: "Une tâche vous a été attribuée",
          message: `${title.trim()}${description ? `\n\n${description}` : ""}\n\nPriorité : ${priority || "moyenne"}${echeance}`,
          ctaLabel: "Voir la tâche",
          ctaPath: "/taches",
        });
      } catch (e) { console.warn("[notify-mail] envoi tâche échoué :", e instanceof Error ? e.message : String(e)); }
    });
  }

  return NextResponse.json(formatTask(task), { status: 201 });
}
