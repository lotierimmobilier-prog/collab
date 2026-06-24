import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      ...(body.name    !== undefined && { name: body.name }),
      ...(body.type    !== undefined && { type: body.type }),
      ...(body.contact !== undefined && { contact: body.contact || null }),
      ...(body.phone   !== undefined && { phone: body.phone || null }),
      ...(body.email   !== undefined && { email: body.email || null }),
      ...(body.address !== undefined && { address: body.address || null }),
      ...(body.siret   !== undefined && { siret: body.siret || null }),
      ...(body.notes   !== undefined && { notes: body.notes || null }),
      ...(body.active  !== undefined && { active: body.active }),
    },
  });

  return NextResponse.json({ ...supplier, createdAt: supplier.createdAt.toISOString(), updatedAt: supplier.updatedAt.toISOString() });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
