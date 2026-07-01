import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { agentAllowed } from "@/lib/ai-agents";
import { orchestrate } from "@/lib/ai-orchestrate";
import { normalizeError } from "@/lib/auguste";

export const maxDuration = 120;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// POST /api/ai-agents/orchestrate — Auguste (chef d'orchestre) mobilise les
// assistants pertinents pour répondre à un objectif.
// body : { objective, agentIds?: string[] }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = session.user.roleId ?? "";

  const body = await req.json().catch(() => ({}));
  const objective = String(body?.objective ?? "").trim().slice(0, 4000);
  if (!objective) return NextResponse.json({ error: "Objectif requis." }, { status: 400 });

  // Assistants actifs auxquels l'utilisateur a accès (cloisonnement conservé).
  const all = (await prisma.aiAgent.findMany({ where: { active: true }, orderBy: { order: "asc" } }).catch(() => [])) as Any[];
  let agents = all.filter(a => agentAllowed(a.accessRoles, role));
  // Restriction éventuelle à une sélection d'assistants.
  if (Array.isArray(body?.agentIds) && body.agentIds.length) {
    const set = new Set(body.agentIds.map(String));
    agents = agents.filter(a => set.has(a.id));
  }

  try {
    const result = await orchestrate(objective, agents);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const err = normalizeError(e);
    return NextResponse.json({ error: err.message }, { status: err.status || 500 });
  }
}
