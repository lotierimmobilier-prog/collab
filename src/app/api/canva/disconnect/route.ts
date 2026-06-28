import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { disconnectCanva } from "@/lib/canva";

// POST /api/canva/disconnect — déconnecte le compte Canva de l'utilisateur.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  await disconnectCanva(session.user.id);
  return NextResponse.json({ ok: true });
}
