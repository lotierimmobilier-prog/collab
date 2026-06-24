import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const ASSIGNEE_COLORS = ["#B8966A","#059669","#2563EB","#7C3AED","#DC2626","#D97706"];
function colorForId(id: string) {
  return ASSIGNEE_COLORS[id.charCodeAt(0) % ASSIGNEE_COLORS.length];
}

function formatTask(t: {
  id: string; title: string; description: string | null; status: string;
  priority: string; assigneeName: string | null; dueDate: Date | null;
  tags: string[]; project: string | null; createdAt: Date; updatedAt: Date;
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
    createdAt:        t.createdAt.toISOString(),
    updatedAt:        t.updatedAt.toISOString(),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const tasks = await prisma.task.findMany({
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
  const { title, description, status, priority, assigneeId, assigneeName, dueDate, tags, project, familyId, groupId } = body;

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
  }

  return NextResponse.json(formatTask(task), { status: 201 });
}
