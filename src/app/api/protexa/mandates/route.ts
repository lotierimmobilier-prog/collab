import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirectionRole } from "@/lib/dashboard-prefs";
import { excludedSet, normName } from "@/lib/protexa";

// GET /api/protexa/mandates — compteurs de mandats signés par négociateur
// (transaction / gestion), pour le tableau de bord. Réservé à la direction
// (admin / dirigeant / direction) : c'est un indicateur de pilotage.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const excl = await excludedSet();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = (await prisma.protexaMandate.findMany({
    orderBy: [{ transaction: "desc" }, { gestion: "desc" }],
  }).catch(() => [])).filter((r) => !excl.has(normName(r.negociateur)));

  const q4 = (a: unknown): number[] => {
    const arr = Array.isArray(a) ? a.slice(0, 4).map(x => Math.max(0, Math.round(Number(x) || 0))) : [];
    while (arr.length < 4) arr.push(0);
    return arr;
  };
  const negociateurs = rows.map(r => {
    const qr = (r.quarters && typeof r.quarters === "object") ? r.quarters : {};
    const t = q4(qr.t);
    const g = q4(qr.g);
    return {
      negociateur: r.negociateur as string,
      transaction: r.transaction as number,
      gestion: r.gestion as number,
      total: (r.transaction as number) + (r.gestion as number),
      // détail par trimestre : t[0..3] = T1..T4 (transaction), g[0..3] = gestion
      t, g,
      userId: (r.userId as string) || null,
    };
  });
  const totals = negociateurs.reduce(
    (s, r) => ({ transaction: s.transaction + r.transaction, gestion: s.gestion + r.gestion, total: s.total + r.total }),
    { transaction: 0, gestion: 0, total: 0 },
  );

  const sync = await prisma.setting.findUnique({ where: { key: "protexa_synced_at" } }).catch(() => null);

  return NextResponse.json({ negociateurs, totals, syncedAt: sync?.value ?? null });
}
