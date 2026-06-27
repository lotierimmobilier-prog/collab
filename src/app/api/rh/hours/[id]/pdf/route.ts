import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildDecomptePdf } from "@/lib/decompte-pdf";
import { monthLabel, type DayEntry } from "@/lib/decompte";

const VALIDATORS = ["admin", "dirigeant", "direction"];

// GET /api/rh/hours/[id]/pdf — décompte des heures au format PDF (employé ou direction).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h: any = await prisma.monthlyHours.findUnique({ where: { id } });
  if (!h) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (h.userId !== session.user.id && !VALIDATORS.includes(session.user.roleId ?? ""))
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

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
