import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    include: { assignee: { select: { id: true, prenom: true, nom: true } } },
  });

  return NextResponse.json(tasks.map(t => ({
    ...t,
    dueDate: t.dueDate?.toISOString().split("T")[0] ?? undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { title, description, status, priority, assigneeId, assigneeName, dueDate, tags, project } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Titre requis" }, { status: 400 });

  const task = await prisma.task.create({
    data: {
      title: title.trim(),
      description: description || null,
      status: status || "todo",
      priority: priority || "moyenne",
      assigneeId: assigneeId || null,
      assigneeName: assigneeName || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      tags: tags || [],
      project: project || null,
    },
    include: { assignee: { select: { id: true, prenom: true, nom: true } } },
  });

  // Notification pour l'assigné
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

  return NextResponse.json({ ...task, dueDate: task.dueDate?.toISOString().split("T")[0] ?? undefined }, { status: 201 });
}
