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

  return NextResponse.json(suppliers.map(s => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    ordersCount: s._count.orders,
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { name, type, contact, phone, email, address, siret, notes } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const supplier = await prisma.supplier.create({
    data: { name: name.trim(), type: type || "autre", contact: contact || null, phone: phone || null, email: email || null, address: address || null, siret: siret || null, notes: notes || null },
  });

  return NextResponse.json({ ...supplier, createdAt: supplier.createdAt.toISOString(), updatedAt: supplier.updatedAt.toISOString() }, { status: 201 });
}
