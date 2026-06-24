import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const tenants = await prisma.tenant.findMany({
    include: {
      baux: {
        include: {
          bail: {
            include: { lot: { select: { reference: true, address: true, status: true } } },
            where: { status: "active" },
          },
        },
      },
    },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });
  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const tenant = await prisma.tenant.create({
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
  return NextResponse.json(tenant, { status: 201 });
}
