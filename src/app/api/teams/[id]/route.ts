import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  const { name, color, icon, order, memberIds } = await req.json();

  const team = await prisma.team.update({
    where: { id },
    data: {
      ...(name && { name: name.trim() }),
      ...(color && { color }),
      ...(icon !== undefined && { icon }),
      ...(order !== undefined && { order }),
      ...(memberIds !== undefined && {
        members: {
          deleteMany: {},
          create: memberIds.map((userId: string) => ({ userId })),
        },
      }),
    },
    include: { members: { include: { user: { select: { id: true, prenom: true, nom: true, email: true, active: true } } } } },
  });
  return NextResponse.json(team);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await params;
  // Dissocier les familles avant suppression
  await prisma.taskFamily.updateMany({ where: { teamId: id }, data: { teamId: null } });
  await prisma.team.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
