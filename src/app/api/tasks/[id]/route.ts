import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { nextRecurrenceDate } from "@/lib/tasks";
import { sendNotificationEmail, userEmail } from "@/lib/notify-mail";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  // Pour détecter un (ré)assignement, on lit l'assigné actuel avant la mise à jour.
  const prev = await prisma.task.findUnique({ where: { id }, select: { assigneeId: true } }).catch(() => null);

  // Complétion : en passant à "done" on enregistre la date/heure et l'auteur ;
  // en quittant "done" on les efface.
  let completion: { completedAt?: Date | null; completedById?: string | null } = {};
  if (body.status !== undefined) {
    completion = body.status === "done"
      ? { completedAt: new Date(), completedById: session.user.id }
      : { completedAt: null, completedById: null };
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(body.title      !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status     !== undefined && { status: body.status }),
      ...(body.priority   !== undefined && { priority: body.priority }),
      ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId }),
      ...(body.assigneeName !== undefined && { assigneeName: body.assigneeName }),
      ...(body.dueDate    !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
      ...(body.tags       !== undefined && { tags: body.tags }),
      ...(body.project    !== undefined && { project: body.project }),
      ...(body.recurrence !== undefined && { recurrence: body.recurrence || null }),
      ...completion,
    },
  });

  // Tâche récurrente terminée → on régénère une occurrence « à faire »,
  // échéance décalée du délai de récurrence.
  if (body.status === "done" && task.recurrence) {
    const next = nextRecurrenceDate(task.recurrence);
    if (next) {
      await prisma.task.create({
        data: {
          title: task.title, description: task.description, status: "todo",
          priority: task.priority, assigneeId: task.assigneeId, assigneeName: task.assigneeName,
          familyId: task.familyId, groupId: task.groupId, tags: task.tags, project: task.project,
          recurrence: task.recurrence, dueDate: next, createdById: task.createdById ?? session.user.id,
        },
      }).catch(() => { /* la colonne recurrence n'existe peut-être pas encore */ });
    }
  }

  // (Ré)assignement à un autre agent → notification interne + email (best-effort).
  const newAssignee = body.assigneeId;
  if (newAssignee && newAssignee !== prev?.assigneeId && newAssignee !== session.user.id) {
    await prisma.notification.create({
      data: { userId: newAssignee, type: "task", title: "Tâche assignée", body: task.title, link: "/taches" },
    }).catch(() => {});
    const u = await userEmail(newAssignee);
    if (u) {
      const echeance = task.dueDate ? `\nÉchéance : ${task.dueDate.toLocaleDateString("fr-FR")}` : "";
      await sendNotificationEmail({
        to: u.email,
        subject: `Tâche assignée : ${task.title}`,
        heading: "Une tâche vous a été attribuée",
        message: `${task.title}${task.description ? `\n\n${task.description}` : ""}\n\nPriorité : ${task.priority}${echeance}`,
        ctaLabel: "Voir la tâche",
        ctaPath: "/taches",
      });
    }
  }

  return NextResponse.json({
    ...task,
    dueDate: task.dueDate?.toISOString().split("T")[0] ?? undefined,
    completedAt: task.completedAt?.toISOString() ?? undefined,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
