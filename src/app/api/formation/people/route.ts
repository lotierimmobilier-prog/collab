import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/formation/people — contexte de l'utilisateur courant pour la formation :
//   - isAdmin
//   - me (avec son parrain)
//   - filleuls (les personnes dont je suis le parrain)
//   - users (admin uniquement : tout le monde + leur parrain, pour l'affectation)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const isAdmin = session.user.roleId === "admin";

  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, prenom: true, nom: true, email: true, roleId: true, parrainId: true,
      parrain: { select: { id: true, prenom: true, nom: true, email: true } },
    },
  });

  const filleuls = await prisma.user.findMany({
    where: { parrainId: session.user.id },
    select: { id: true, prenom: true, nom: true, email: true, active: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });

  let users: unknown[] = [];
  if (isAdmin) {
    users = await prisma.user.findMany({
      select: {
        id: true, prenom: true, nom: true, email: true, roleId: true, active: true, parrainId: true,
        parrain: { select: { id: true, prenom: true, nom: true } },
      },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    });
  }

  return NextResponse.json({ isAdmin, me, filleuls, users });
}
