import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { computeOverview } from "@/lib/formation-overview";

// GET /api/formation/overview — tableau de bord de contrôle de la formation.
//   Admin : tous les filleuls de l'agence. Parrain : ses propres filleuls.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const isAdmin = session.user.roleId === "admin";
  try {
    const ov = await computeOverview(session.user.id, isAdmin);
    return NextResponse.json({ isAdmin, ...ov });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
