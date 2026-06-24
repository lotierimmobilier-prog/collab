import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const families = await prisma.taskFamily.findMany({
    orderBy: { order: "asc" },
    include: {
      groups: { orderBy: { order: "asc" } },
      _count: { select: { tasks: true } },
    },
  });
  return NextResponse.json(families);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });

  const { name, description, color, icon } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const count = await prisma.taskFamily.count();
  const family = await prisma.taskFamily.create({
    data: { name: name.trim(), description, color: color ?? "#B8966A", icon, order: count },
  });
  return NextResponse.json(family, { status: 201 });
}
