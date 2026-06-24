import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const depots = await prisma.depotGarantie.findMany({
    include: { bail: { include: { lot: { select: { reference: true, label: true, address: true } }, tenants: { include: { tenant: { select: { prenom: true, nom: true } } } } } } },
    orderBy: { dateRecep: "desc" },
  });
  return NextResponse.json(depots);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json();
  const depot = await prisma.depotGarantie.create({
    data: {
      id: crypto.randomUUID(),
      bailId: body.bailId,
      montant: parseFloat(body.montant),
      dateRecep: new Date(body.dateRecep),
      dateRestitution: body.dateRestitution ? new Date(body.dateRestitution) : null,
      montantRestitue: body.montantRestitue ? parseFloat(body.montantRestitue) : null,
      status: body.status ?? "conserve",
      notes: body.notes || null,
    },
    include: { bail: { include: { lot: true, tenants: { include: { tenant: true } } } } },
  });
  return NextResponse.json(depot, { status: 201 });
}
