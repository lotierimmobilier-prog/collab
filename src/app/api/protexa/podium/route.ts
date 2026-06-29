import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { excludedSet, normName } from "@/lib/protexa";

// GET /api/protexa/podium — classement des négociateurs (mandats transaction /
// gestion, par trimestre et année) pour le podium du tableau de bord. Visible
// par TOUS les utilisateurs connectés (leaderboard motivant). Les comptes non
// commerciaux (agence, non affecté…) sont exclus.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const excl = await excludedSet();
  const q4 = (a: unknown): number[] => {
    const arr = Array.isArray(a) ? a.slice(0, 4).map((x) => Math.max(0, Math.round(Number(x) || 0))) : [];
    while (arr.length < 4) arr.push(0);
    return arr;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = (await prisma.protexaMandate.findMany().catch(() => []))
    .filter((r) => !excl.has(normName(r.negociateur)));

  const negociateurs = rows.map((r) => {
    const qr = (r.quarters && typeof r.quarters === "object") ? r.quarters : {};
    return {
      negociateur: r.negociateur as string,
      transaction: r.transaction as number,
      gestion: r.gestion as number,
      t: q4(qr.t),
      g: q4(qr.g),
    };
  });

  const sync = await prisma.setting.findUnique({ where: { key: "protexa_synced_at" } }).catch(() => null);
  return NextResponse.json({ negociateurs, syncedAt: sync?.value ?? null });
}
