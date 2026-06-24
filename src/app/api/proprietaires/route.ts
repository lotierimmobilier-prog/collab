import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const owners = await prisma.owner.findMany({
    include: { _count: { select: { lots: true } }, lots: { include: { baux: { where: { status: "active" }, select: { monthlyRent: true, charges: true } } } } },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });
  return NextResponse.json(owners);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json();
  const owner = await prisma.owner.create({
    data: {
      id: crypto.randomUUID(),
      prenom: body.prenom,
      nom: body.nom,
      ownerType: body.ownerType ?? "individual",
      email: body.email || null,
      phone: body.phone || null,
      mobile: body.mobile || null,
      companyName: body.companyName || null,
      siret: body.siret || null,
      address: body.address || null,
      iban: body.iban || null,
      bic: body.bic || null,
      bankName: body.bankName || null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(owner, { status: 201 });
}
