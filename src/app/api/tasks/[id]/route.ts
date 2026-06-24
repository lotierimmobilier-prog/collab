import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

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
    },
  });
  return NextResponse.json({ ...task, dueDate: task.dueDate?.toISOString().split("T")[0] ?? undefined });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
