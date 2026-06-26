import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runMigrations } from "@/lib/run-migrations";

// GET /api/formation/people — contexte de l'utilisateur courant pour la formation :
//   - isAdmin
//   - me (avec son parrain)
//   - filleuls (les personnes dont je suis le parrain)
//   - users (admin uniquement : tout le monde + leur parrain, pour l'affectation)
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const isAdmin = session.user.roleId === "admin";
  const uid = session.user.id;

  async function load() {
    const me = await prisma.user.findUnique({
      where: { id: uid },
      select: {
        id: true, prenom: true, nom: true, email: true, roleId: true, parrainId: true,
        parrain: { select: { id: true, prenom: true, nom: true, email: true } },
      },
    });
    const filleuls = await prisma.user.findMany({
      where: { parrainId: uid },
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
    return { isAdmin, me, filleuls, users };
  }

  try {
    return NextResponse.json(await load());
  } catch (e) {
    // Auto-réparation : si la colonne parrainId manque encore, on applique les
    // migrations puis on réessaie une fois.
    if (/parrainId|does not exist/i.test(String(e))) {
      try { await runMigrations(); return NextResponse.json(await load()); }
      catch (e2) { return NextResponse.json({ error: String(e2) }, { status: 500 }); }
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
