import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirectionRole } from "@/lib/dashboard-prefs";

// GET /api/protexa/mandates — compteurs de mandats signés par négociateur
// (transaction / gestion), pour le tableau de bord. Réservé à la direction
// (admin / dirigeant / direction) : c'est un indicateur de pilotage.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.protexaMandate.findMany({
    orderBy: [{ transaction: "desc" }, { gestion: "desc" }],
  }).catch(() => []);

  const negociateurs = rows.map(r => ({
    negociateur: r.negociateur as string,
    transaction: r.transaction as number,
    gestion: r.gestion as number,
    total: (r.transaction as number) + (r.gestion as number),
    userId: (r.userId as string) || null,
  }));
  const totals = negociateurs.reduce(
    (s, r) => ({ transaction: s.transaction + r.transaction, gestion: s.gestion + r.gestion, total: s.total + r.total }),
    { transaction: 0, gestion: 0, total: 0 },
  );

  const sync = await prisma.setting.findUnique({ where: { key: "protexa_synced_at" } }).catch(() => null);

  return NextResponse.json({ negociateurs, totals, syncedAt: sync?.value ?? null });
}
