import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const userId = (session.user as { id?: string }).id;
  const isAdmin = session.user.roleId === "admin" || session.user.roleId === "direction";

  // Récupérer les équipes dont l'utilisateur est membre
  let userTeamIds: string[] = [];
  if (userId && !isAdmin) {
    const memberships = await prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } });
    userTeamIds = memberships.map(m => m.teamId);
  }

  const families = await prisma.taskFamily.findMany({
    where: isAdmin
      ? undefined // admin/direction voit tout
      : { OR: [{ teamId: null }, { teamId: { in: userTeamIds } }] },
    orderBy: { order: "asc" },
    include: {
      groups: { orderBy: { order: "asc" } },
      team: { select: { id: true, name: true, color: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });
  return NextResponse.json(families);
}

export async function GET_teams() {
  // endpoint séparé — utilisé par l'admin
  const teams = await prisma.team.findMany({ orderBy: { order: "asc" } });
  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });

  const { name, description, color, icon, teamId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const count = await prisma.taskFamily.count();
  const family = await prisma.taskFamily.create({
    data: { name: name.trim(), description, color: color ?? "#B8966A", icon, order: count, teamId: teamId || null },
    include: { team: { select: { id: true, name: true, color: true, icon: true } } },
  });
  return NextResponse.json(family, { status: 201 });
}
