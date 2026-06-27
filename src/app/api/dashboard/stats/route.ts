import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta } from "@/lib/comptabilite";

// GET /api/dashboard/stats — quelques indicateurs pour le bandeau d'accueil :
//   - tâches terminées ce mois + délai moyen de réalisation + tâches en cours
//   - CA du mois + mois précédent (direction uniquement)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endPrev = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  // ── Tâches de l'utilisateur ──
  const tasks = { doneMonth: 0, avgDays: null as number | null, openCount: 0 };
  try {
    const done = await prisma.task.findMany({
      where: { assigneeId: uid, completedAt: { gte: startMonth } },
      select: { createdAt: true, completedAt: true },
    });
    tasks.doneMonth = done.length;
    if (done.length) {
      const totalMs = done.reduce((s, t) => s + (t.completedAt!.getTime() - t.createdAt.getTime()), 0);
      tasks.avgDays = Math.max(0, Math.round((totalMs / done.length) / 86_400_000 * 10) / 10);
    }
    tasks.openCount = await prisma.task.count({ where: { assigneeId: uid, completedAt: null } });
  } catch { /* table absente */ }

  // ── CA (direction uniquement) — produits = opérations créditrices ──
  let ca: { month: number; prevMonth: number; deltaPct: number | null } | null = null;
  if (canAccessCompta(session.user.roleId)) {
    try {
      const sum = async (gte: Date, lte: Date) => {
        const r = await prisma.bankTransaction.aggregate({
          _sum: { amount: true },
          where: { amount: { gt: 0 }, date: { gte, lte } },
        });
        return Math.round(r._sum.amount ?? 0);
      };
      const month = await sum(startMonth, now);
      const prevMonth = await sum(startPrev, endPrev);
      const deltaPct = prevMonth > 0 ? Math.round(((month - prevMonth) / prevMonth) * 100) : null;
      ca = { month, prevMonth, deltaPct };
    } catch { /* table absente */ }
  }

  return NextResponse.json({ tasks, ca });
}
