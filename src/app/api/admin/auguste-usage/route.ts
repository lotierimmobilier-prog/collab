import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isSuperSession } from "@/lib/drive-governance";
import { monthlySummary, realClaudeCost } from "@/lib/auguste-usage";

// GET /api/admin/auguste-usage — synthèse mensuelle de consommation Auguste
// (tokens + coût estimé par agent + total) + coût réel du compte Claude si une
// clé Admin Anthropic est configurée. Réservé au super administrateur.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuperSession(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });

  const summary = await monthlySummary();
  const real = await realClaudeCost();
  return NextResponse.json({ ...summary, real });
}
