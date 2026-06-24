import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.bail.count({ where: { reference: { startsWith: `BAIL-${year}-` } } });
  return `BAIL-${year}-${String(count + 1).padStart(3, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const lotId = searchParams.get("lotId");
  const baux = await prisma.bail.findMany({
    where: lotId ? { lotId } : undefined,
    include: {
      lot: { select: { id: true, reference: true, address: true, label: true } },
      tenants: { include: { tenant: { select: { id: true, prenom: true, nom: true, email: true, phone: true } } } },
    },
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json(baux);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json();
  const reference = await nextRef();
  const bail = await prisma.bail.create({
    data: {
      id: crypto.randomUUID(),
      reference,
      lotId: body.lotId,
      leaseType: body.leaseType ?? "residential",
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      monthlyRent: parseFloat(body.monthlyRent),
      charges: parseFloat(body.charges ?? 0),
      deposit: body.deposit ? parseFloat(body.deposit) : null,
      renewalType: body.renewalType ?? "tacit",
      status: body.status ?? "active",
      signedDate: body.signedDate ? new Date(body.signedDate) : null,
      notes: body.notes || null,
      createdBy: session.user.id!,
    },
    include: {
      lot: { select: { id: true, reference: true, address: true, label: true } },
      tenants: { include: { tenant: true } },
    },
  });

  // Lier les locataires
  if (body.tenantIds?.length) {
    await prisma.bailTenant.createMany({
      data: body.tenantIds.map((tid: string) => ({ id: crypto.randomUUID(), bailId: bail.id, tenantId: tid })),
      skipDuplicates: true,
    });
    // Mettre le lot en statut "occupé"
    await prisma.lot.update({ where: { id: body.lotId }, data: { status: "occupied" } });
  }

  return NextResponse.json(bail, { status: 201 });
}
