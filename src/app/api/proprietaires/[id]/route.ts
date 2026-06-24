import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const owner = await prisma.owner.update({
    where: { id },
    data: {
      ...(body.prenom      !== undefined && { prenom: body.prenom }),
      ...(body.nom         !== undefined && { nom: body.nom }),
      ...(body.ownerType   !== undefined && { ownerType: body.ownerType }),
      ...(body.email       !== undefined && { email: body.email || null }),
      ...(body.phone       !== undefined && { phone: body.phone || null }),
      ...(body.mobile      !== undefined && { mobile: body.mobile || null }),
      ...(body.companyName !== undefined && { companyName: body.companyName || null }),
      ...(body.siret       !== undefined && { siret: body.siret || null }),
      ...(body.address     !== undefined && { address: body.address || null }),
      ...(body.iban        !== undefined && { iban: body.iban || null }),
      ...(body.bic         !== undefined && { bic: body.bic || null }),
      ...(body.bankName    !== undefined && { bankName: body.bankName || null }),
      ...(body.notes       !== undefined && { notes: body.notes || null }),
    },
  });
  return NextResponse.json(owner);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.owner.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
