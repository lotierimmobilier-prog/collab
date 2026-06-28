import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { depositQuittance } from "@/lib/quittance";

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.encaissement.count({ where: { reference: { startsWith: `ENC-${year}-` } } });
  return `ENC-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const bailId = searchParams.get("bailId");
  const enc = await prisma.encaissement.findMany({
    where: bailId ? { bailId } : undefined,
    include: {
      bail: { include: { lot: { select: { reference: true, label: true } }, tenants: { include: { tenant: { select: { prenom: true, nom: true } } } } } },
      appel: { select: { reference: true, periode: true } },
    },
    orderBy: { dateReglement: "desc" },
  });
  return NextResponse.json(enc);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json();
  const reference = await nextRef();
  const enc = await prisma.encaissement.create({
    data: {
      id: crypto.randomUUID(), reference,
      bailId: body.bailId,
      appelId: body.appelId || null,
      montant: parseFloat(body.montant),
      dateReglement: new Date(body.dateReglement),
      modePaiement: body.modePaiement ?? "virement",
      reference_paiement: body.reference_paiement || null,
      notes: body.notes || null,
    },
    include: { bail: { include: { lot: true, tenants: { include: { tenant: true } } } }, appel: true },
  });
  // Mettre à jour le statut de l'appel si lié
  if (body.appelId) {
    const appel = await prisma.appelLoyer.findUnique({ where: { id: body.appelId }, include: { encaissements: true } });
    if (appel) {
      const totalEnc = appel.encaissements.reduce((s, e) => s + e.montant, 0) + parseFloat(body.montant);
      const status = totalEnc >= appel.totalCC ? "regle" : totalEnc > 0 ? "partiel" : "emis";
      await prisma.appelLoyer.update({ where: { id: body.appelId }, data: { status } });
    }
  }
  // Quittance déposée automatiquement dans l'espace du/des locataire(s).
  after(() => depositQuittance(enc));

  return NextResponse.json(enc, { status: 201 });
}
