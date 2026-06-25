import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !["admin","direction","dirigeant"].includes(session.user.roleId ?? ""))
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const family = await prisma.taskFamily.update({
    where: { id },
    data: {
      ...(body.name        !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.color       !== undefined && { color: body.color }),
      ...(body.icon        !== undefined && { icon: body.icon }),
      ...(body.order       !== undefined && { order: body.order }),
      ...(body.teamId      !== undefined && { teamId: body.teamId || null }),
    },
    include: { team: { select: { id: true, name: true, color: true, icon: true } } },
  });
  return NextResponse.json(family);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !["admin","direction","dirigeant"].includes(session.user.roleId ?? ""))
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });
  const { id } = await params;
  await prisma.taskFamily.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
