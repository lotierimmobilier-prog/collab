import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });

  const { familyId, name, description } = await req.json();
  if (!familyId || !name?.trim()) return NextResponse.json({ error: "familyId et nom requis" }, { status: 400 });

  const count = await prisma.taskGroup.count({ where: { familyId } });
  const group = await prisma.taskGroup.create({
    data: { familyId, name: name.trim(), description, order: count },
  });
  return NextResponse.json(group, { status: 201 });
}
