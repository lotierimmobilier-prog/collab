import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBinomes } from "@/lib/parrainage-binome";

// GET /api/parrainage/binome — parrain + filleuls de l'utilisateur courant,
// pour proposer le partage d'un créneau sur le planning parrainage.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const binomes = await getBinomes(session.user.id);
  return NextResponse.json({ binomes });
}
