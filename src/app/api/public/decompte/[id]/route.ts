import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDecompteToken } from "@/lib/rh-automation";
import { buildDecomptePdf } from "@/lib/decompte-pdf";
import { monthLabel, type DayEntry } from "@/lib/decompte";

// GET /api/public/decompte/[id]?t=<jeton> — téléchargement public (lien comptable).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = new URL(req.url).searchParams.get("t") || "";
  if (!verifyDecompteToken(id, t)) return NextResponse.json({ error: "Lien invalide." }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h: any = await prisma.monthlyHours.findUnique({ where: { id } }).catch(() => null);
  if (!h) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const entries: DayEntry[] = Array.isArray(h.entries) ? h.entries : [];
  const pdf = await buildDecomptePdf({
    societe: h.societe, employe: h.employe, month: h.month, monthLabel: monthLabel(h.month),
    heureHebdo: h.heureHebdo, entries,
    avantageNature: h.avantageNature, acompte: h.acompte, acompteMode: h.acompteMode,
    primeMotif: h.primeMotif, primeMontant: h.primeMontant,
    agentSignatureName: h.agentSignatureName, agentSignedAt: h.agentSignedAt,
    directionSignatureName: h.directionSignatureName, directionSignedAt: h.directionSignedAt,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="decompte-heures-${h.month}.pdf"`,
    },
  });
}
