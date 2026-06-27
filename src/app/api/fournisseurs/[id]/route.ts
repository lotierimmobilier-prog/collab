import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const MAX = 20 * 1024 * 1024;
  if (body.insuranceDoc?.data) {
    const bytes = Math.ceil((String(body.insuranceDoc.data).length * 3) / 4);
    if (bytes > MAX) return NextResponse.json({ error: "Attestation trop volumineuse (max 20 Mo)." }, { status: 413 });
  }

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
      ...(body.insuranceType   !== undefined && { insuranceType: body.insuranceType || null }),
      ...(body.insurer         !== undefined && { insurer: body.insurer || null }),
      ...(body.insurancePolicy !== undefined && { insurancePolicy: body.insurancePolicy || null }),
      ...(body.insuranceExpiry !== undefined && { insuranceExpiry: body.insuranceExpiry ? new Date(body.insuranceExpiry) : null }),
      ...(body.insuranceDoc    !== undefined && { insuranceDoc: body.insuranceDoc?.data ? {
        name: String(body.insuranceDoc.name || "attestation").slice(0, 200),
        mime: body.insuranceDoc.mime ? String(body.insuranceDoc.mime) : null,
        size: body.insuranceDoc.size ? Number(body.insuranceDoc.size) : null,
        data: String(body.insuranceDoc.data),
      } : (body.insuranceDoc === null ? null : undefined) }),
    },
  });

  const { insuranceDoc, ...rest } = supplier;
  return NextResponse.json({ ...rest, hasInsuranceDoc: !!insuranceDoc, createdAt: supplier.createdAt.toISOString(), updatedAt: supplier.updatedAt.toISOString(), insuranceExpiry: supplier.insuranceExpiry ? supplier.insuranceExpiry.toISOString() : null });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
