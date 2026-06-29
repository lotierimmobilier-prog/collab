import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

// DELETE /api/ai-agents/[id]/docs/[docId] — retirer un document de la base de
// connaissance (direction). Les fragments associés sont supprimés en cascade.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { docId } = await ctx.params;

  await prisma.aiAgentDoc.delete({ where: { id: docId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
