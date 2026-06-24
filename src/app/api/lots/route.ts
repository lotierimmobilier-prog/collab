import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.lot.count();
  return `LOT-${year}-${String(count + 1).padStart(3, "0")}`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const lots = await prisma.lot.findMany({
    include: { owner: { select: { id: true, prenom: true, nom: true, companyName: true } }, baux: { where: { status: "active" }, take: 1 } },
    orderBy: { reference: "asc" },
  });
  return NextResponse.json(lots);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json();
  const reference = body.reference?.trim() || await nextRef();
  const lot = await prisma.lot.create({
    data: {
      id: crypto.randomUUID(),
      reference,
      label: body.label || null,
      address: body.address,
      lotType: body.lotType ?? "apartment",
      surface: body.surface ? parseFloat(body.surface) : null,
      rooms: body.rooms ? parseInt(body.rooms) : null,
      floor: body.floor !== undefined && body.floor !== "" ? parseInt(body.floor) : null,
      status: body.status ?? "vacant",
      ownerId: body.ownerId || null,
      notes: body.notes || null,
    },
    include: { owner: { select: { id: true, prenom: true, nom: true, companyName: true } }, baux: true },
  });
  return NextResponse.json(lot, { status: 201 });
}
