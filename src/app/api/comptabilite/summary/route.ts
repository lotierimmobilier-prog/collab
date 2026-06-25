import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta, SERVICE_IDS } from "@/lib/comptabilite";

/** GET ?from=&to= — trésorerie par compte (séparée), alertes de seuil, frais par service. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canAccessCompta(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const from = sp.get("from"); const to = sp.get("to");
  const dateFilter = (from || to) ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {};

  const accounts = await prisma.bankAccount.findMany({ orderBy: { createdAt: "asc" } });

  // Solde par compte = solde initial + somme de TOUTES les opérations (le solde
  // n'est pas borné par la période ; la période ne sert qu'aux frais par service).
  const sums = await prisma.bankTransaction.groupBy({ by: ["accountId"], _sum: { amount: true } });
  const sumByAccount = new Map(sums.map(s => [s.accountId, s._sum.amount ?? 0]));

  const treasury = accounts.map(a => {
    const balance = a.openingBalance + (sumByAccount.get(a.id) ?? 0);
    const belowThreshold = a.threshold != null && balance < a.threshold;
    return {
      id: a.id, name: a.name, kind: a.kind, openingBalance: a.openingBalance,
      threshold: a.threshold, balance, belowThreshold,
    };
  });

  // Séparation stricte : on n'agrège jamais gestion + syndic ensemble.
  const byKind: Record<string, number> = { gestion: 0, syndic: 0, agence: 0 };
  for (const t of treasury) byKind[t.kind] = (byKind[t.kind] ?? 0) + t.balance;

  const alerts = treasury.filter(t => t.belowThreshold)
    .map(t => ({ accountId: t.id, name: t.name, balance: t.balance, threshold: t.threshold }));

  // Frais par service (débits) sur la période
  const debits = await prisma.bankTransaction.groupBy({
    by: ["service"],
    where: { amount: { lt: 0 }, ...dateFilter },
    _sum: { amount: true },
    _count: true,
  });
  const credits = await prisma.bankTransaction.groupBy({
    by: ["service"],
    where: { amount: { gt: 0 }, ...dateFilter },
    _sum: { amount: true },
  });
  const creditByService = new Map(credits.map(c => [c.service ?? "none", c._sum.amount ?? 0]));

  const byService = SERVICE_IDS.map(s => {
    const d = debits.find(x => x.service === s);
    return {
      service: s,
      depenses: Math.abs(d?._sum.amount ?? 0),
      recettes: creditByService.get(s) ?? 0,
      count: d?._count ?? 0,
    };
  });
  const nonVentile = (debits.find(x => x.service === null)?._count ?? 0);

  return NextResponse.json({ treasury, byKind, alerts, byService, nonVentile });
}
