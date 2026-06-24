import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: { baux: { include: { bail: { include: { lot: true } } } } },
  });
  if (!tenant) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(tenant);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const tenant = await prisma.tenant.update({
    where: { id },
    data: {
      prenom: body.prenom,
      nom: body.nom,
      email: body.email || null,
      phone: body.phone || null,
      mobile: body.mobile || null,
      address: body.address || null,
      birthDate: body.birthDate || null,
      profession: body.profession || null,
      emergencyName: body.emergencyName || null,
      emergencyPhone: body.emergencyPhone || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(tenant);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.tenant.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
