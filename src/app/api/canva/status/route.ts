import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canvaConfigured, getStoredToken } from "@/lib/canva";

// GET /api/canva/status — état de l'intégration Canva pour l'utilisateur.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const configured = canvaConfigured();
  const token = configured ? await getStoredToken(session.user.id) : null;
  return NextResponse.json({ configured, connected: !!token });
}
