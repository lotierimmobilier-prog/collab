import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const bail = await prisma.bail.findUnique({
    where: { id },
    include: {
      lot: { include: { owner: true } },
      tenants: { include: { tenant: true } },
    },
  });
  if (!bail) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(bail);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const bail = await prisma.bail.update({
    where: { id },
    data: {
      ...(body.status      !== undefined && { status: body.status }),
      ...(body.monthlyRent !== undefined && { monthlyRent: parseFloat(body.monthlyRent) }),
      ...(body.charges     !== undefined && { charges: parseFloat(body.charges) }),
      ...(body.endDate     !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
      ...(body.notes       !== undefined && { notes: body.notes || null }),
    },
    include: { lot: true, tenants: { include: { tenant: true } } },
  });
  // Si terminé → lot vacant
  if (body.status === "terminated") {
    await prisma.lot.update({ where: { id: bail.lotId }, data: { status: "vacant" } });
  }
  return NextResponse.json(bail);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.bail.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
