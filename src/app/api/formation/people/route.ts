import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getExtras, filleulsOf } from "@/lib/user-extras";

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
    // Tout le monde (sans relation parrain : la colonne users.parrainId peut ne
    // pas exister). Le parrainage est lu depuis user_extras (source de vérité).
    const all = await prisma.user.findMany({
      select: { id: true, prenom: true, nom: true, email: true, roleId: true, active: true },
      orderBy: [{ nom: "asc" }, { prenom: "asc" }],
    });
    const byId = new Map(all.map(u => [u.id, u]));
    const extras = await getExtras(all.map(u => u.id));
    const parrainOf = (userId: string) => extras.get(userId)?.parrainId ?? null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const slim = (u: any) => u ? { id: u.id, prenom: u.prenom, nom: u.nom, email: u.email } : null;

    const meBase = byId.get(uid) ?? null;
    const myParrainId = parrainOf(uid);
    const me = meBase ? { ...meBase, parrainId: myParrainId, parrain: myParrainId ? slim(byId.get(myParrainId)) : null } : null;

    const filleulIds = await filleulsOf(uid);
    const filleuls = filleulIds
      .map(id => byId.get(id))
      .filter(Boolean)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((u: any) => ({ id: u.id, prenom: u.prenom, nom: u.nom, email: u.email, active: u.active }));

    let users: unknown[] = [];
    if (isAdmin) {
      users = all.map(u => {
        const pid = parrainOf(u.id);
        return { ...u, parrainId: pid, parrain: pid ? slim(byId.get(pid)) : null };
      });
    }
    return { isAdmin, me, filleuls, users };
  }

  try {
    return NextResponse.json(await load());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
