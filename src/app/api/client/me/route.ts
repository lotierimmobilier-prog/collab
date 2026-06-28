import { NextResponse } from "next/server";
import { getClientFromCookie } from "@/lib/client-auth";

// GET /api/client/me — identité du locataire connecté (ou 401).
export async function GET() {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ client: { prenom: client.prenom, nom: client.nom, email: client.email } });
}
