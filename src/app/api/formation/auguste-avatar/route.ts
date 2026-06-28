import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET — avatar/photo d'Auguste défini dans l'admin (réglage auguste_logo_url).
// Accessible à tout utilisateur connecté (lecture seule d'un seul réglage).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const s = await prisma.setting.findUnique({ where: { key: "auguste_logo_url" } }).catch(() => null);
  const url = (s?.value || "").trim();
  return NextResponse.json({ url: url || null });
}
