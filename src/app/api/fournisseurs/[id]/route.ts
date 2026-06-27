import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const MAX = 20 * 1024 * 1024;
  for (const k of ["insuranceDoc", "urssafDoc"] as const) {
    if (body[k]?.data && Math.ceil((String(body[k].data).length * 3) / 4) > MAX)
      return NextResponse.json({ error: "Attestation trop volumineuse (max 20 Mo)." }, { status: 413 });
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
      ...(body.insuranceDoc?.data && { insuranceDoc: {
        name: String(body.insuranceDoc.name || "attestation").slice(0, 200),
        mime: body.insuranceDoc.mime ? String(body.insuranceDoc.mime) : null,
        size: body.insuranceDoc.size ? Number(body.insuranceDoc.size) : null,
        data: String(body.insuranceDoc.data),
      } }),
      ...(body.urssafExpiry !== undefined && { urssafExpiry: body.urssafExpiry ? new Date(body.urssafExpiry) : null }),
      ...(body.urssafDoc?.data && { urssafDoc: {
        name: String(body.urssafDoc.name || "attestation-urssaf").slice(0, 200),
        mime: body.urssafDoc.mime ? String(body.urssafDoc.mime) : null,
        size: body.urssafDoc.size ? Number(body.urssafDoc.size) : null,
        data: String(body.urssafDoc.data),
      } }),
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { insuranceDoc, urssafDoc, ...rest } = supplier as any;
  return NextResponse.json({
    ...rest,
    hasInsuranceDoc: !!insuranceDoc, hasUrssafDoc: !!urssafDoc,
    createdAt: supplier.createdAt.toISOString(), updatedAt: supplier.updatedAt.toISOString(),
    insuranceExpiry: supplier.insuranceExpiry ? supplier.insuranceExpiry.toISOString() : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    urssafExpiry: (supplier as any).urssafExpiry ? new Date((supplier as any).urssafExpiry).toISOString() : null,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.supplier.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
