import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PERF_TYPE_IDS, quarterBounds, quarterBoundsFromKey, quarterLabel } from "@/lib/performance";

/**
 * GET /api/performance/ranking?quarter=2026-T2
 * Classement du trimestre par agent : total + détail par type d'opération.
 * Accessible à tout utilisateur authentifié (vision d'équipe).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const quarterParam = req.nextUrl.searchParams.get("quarter") || "";
  const bounds = quarterBoundsFromKey(quarterParam) ?? quarterBounds();

  const [entries, users] = await Promise.all([
    prisma.performanceEntry.findMany({
      where: { date: { gte: bounds.start, lt: bounds.end } },
      select: { userId: true, type: true, amount: true },
    }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, prenom: true, nom: true, roleId: true } }),
  ]);

  const userById = new Map(users.map(u => [u.id, u]));

  // Agrège par agent
  const byUser = new Map<string, { userId: string; name: string; roleId: string | null; counts: Record<string, number>; amount: number; total: number }>();
  function ensure(userId: string) {
    if (!byUser.has(userId)) {
      const u = userById.get(userId);
      byUser.set(userId, {
        userId,
        name: u ? `${u.prenom} ${u.nom}` : "Agent inconnu",
        roleId: u?.roleId ?? null,
        counts: Object.fromEntries(PERF_TYPE_IDS.map(t => [t, 0])),
        amount: 0,
        total: 0,
      });
    }
    return byUser.get(userId)!;
  }

  for (const e of entries) {
    if (!PERF_TYPE_IDS.includes(e.type)) continue;
    const row = ensure(e.userId);
    row.counts[e.type] += 1;
    row.total += 1;
    if (e.amount) row.amount += e.amount;
  }

  const ranking = [...byUser.values()].sort((a, b) =>
    b.total - a.total || b.amount - a.amount || a.name.localeCompare(b.name)
  );

  // Totaux globaux par type
  const totals = Object.fromEntries(PERF_TYPE_IDS.map(t => [t, 0])) as Record<string, number>;
  for (const r of ranking) for (const t of PERF_TYPE_IDS) totals[t] += r.counts[t];

  return NextResponse.json({
    quarter: `${bounds.year}-T${bounds.quarter}`,
    quarterLabel: quarterLabel(bounds.year, bounds.quarter),
    ranking,
    totals,
  });
}
