import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.appelLoyer.count({ where: { reference: { startsWith: `AL-${year}-` } } });
  return `AL-${year}-${String(count + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const bailId  = searchParams.get("bailId");
  const periode = searchParams.get("periode");
  const appels = await prisma.appelLoyer.findMany({
    where: { ...(bailId ? { bailId } : {}), ...(periode ? { periode } : {}) },
    include: {
      bail: { include: { lot: { select: { reference: true, address: true, label: true } }, tenants: { include: { tenant: { select: { prenom: true, nom: true } } } } } },
      encaissements: { select: { id: true, montant: true, dateReglement: true, modePaiement: true } },
    },
    orderBy: { echeance: "desc" },
  });
  return NextResponse.json(appels);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json();
  const reference = await nextRef();
  const appel = await prisma.appelLoyer.create({
    data: {
      id: crypto.randomUUID(), reference,
      bailId: body.bailId,
      periode: body.periode,
      montantHC: parseFloat(body.montantHC),
      charges: parseFloat(body.charges ?? 0),
      totalCC: parseFloat(body.montantHC) + parseFloat(body.charges ?? 0),
      echeance: new Date(body.echeance),
      status: body.status ?? "emis",
      notes: body.notes || null,
    },
    include: { bail: { include: { lot: true, tenants: { include: { tenant: true } } } }, encaissements: true },
  });
  return NextResponse.json(appel, { status: 201 });
}
