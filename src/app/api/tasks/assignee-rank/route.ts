import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/tasks/assignee-rank — identifiants d'utilisateurs classés par
 * fréquence d'attribution de tâches (historique), du plus sollicité au moins.
 * Sert à proposer les responsables les plus pertinents en premier.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const grouped = await prisma.task.groupBy({
    by: ["assigneeId"],
    where: { assigneeId: { not: null } },
    _count: { assigneeId: true },
  });

  const ranked = grouped
    .filter((g: { assigneeId: string | null }) => g.assigneeId)
    .sort((a: { _count: { assigneeId: number } }, b: { _count: { assigneeId: number } }) => b._count.assigneeId - a._count.assigneeId)
    .map((g: { assigneeId: string | null }) => g.assigneeId as string);

  return NextResponse.json({ ranked });
}
