import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { toggleFavorite } from "@/lib/ai-favorites";

// POST /api/ai-agents/favorite — bascule un assistant en favori pour
// l'utilisateur courant. body: { agentId }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = (session.user as { id?: string }).id ?? "";

  let body: { agentId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const agentId = (body.agentId || "").trim();
  if (!agentId) return NextResponse.json({ error: "agentId requis." }, { status: 400 });

  const res = await toggleFavorite(uid, agentId);
  return NextResponse.json({ ok: true, ...res });
}
