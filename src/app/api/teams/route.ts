import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const teams = await prisma.team.findMany({
    orderBy: { order: "asc" },
    include: {
      members: { include: { user: { select: { id: true, prenom: true, nom: true, email: true, active: true } } } },
    },
  });
  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { name, color, icon, order } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const team = await prisma.team.create({
    data: { name: name.trim(), color: color ?? "#B8966A", icon, order: order ?? 0 },
    include: { members: { include: { user: { select: { id: true, prenom: true, nom: true, email: true, active: true } } } } },
  });
  return NextResponse.json(team);
}
