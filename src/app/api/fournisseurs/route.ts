import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { orders: true } } },
  });

  return NextResponse.json(suppliers.map(s => {
    // On ne renvoie pas le binaire de l'attestation dans la liste (juste un flag).
    const { insuranceDoc, _count, ...rest } = s;
    return {
      ...rest,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      insuranceExpiry: s.insuranceExpiry ? s.insuranceExpiry.toISOString() : null,
      hasInsuranceDoc: !!insuranceDoc,
      ordersCount: _count.orders,
    };
  }));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { name, type, contact, phone, email, address, siret, notes, insuranceType, insurer, insurancePolicy, insuranceExpiry } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const supplier = await prisma.supplier.create({
    data: {
      name: name.trim(), type: type || "autre", contact: contact || null, phone: phone || null,
      email: email || null, address: address || null, siret: siret || null, notes: notes || null,
      insuranceType: insuranceType || null, insurer: insurer || null, insurancePolicy: insurancePolicy || null,
      insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
    },
  });

  const { insuranceDoc, ...rest } = supplier;
  void insuranceDoc;
  return NextResponse.json({ ...rest, createdAt: supplier.createdAt.toISOString(), updatedAt: supplier.updatedAt.toISOString() }, { status: 201 });
}
