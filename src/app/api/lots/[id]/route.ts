import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const lot = await prisma.lot.update({
    where: { id },
    data: {
      ...(body.label     !== undefined && { label: body.label || null }),
      ...(body.address   !== undefined && { address: body.address }),
      ...(body.lotType   !== undefined && { lotType: body.lotType }),
      ...(body.surface   !== undefined && { surface: body.surface ? parseFloat(body.surface) : null }),
      ...(body.rooms     !== undefined && { rooms: body.rooms ? parseInt(body.rooms) : null }),
      ...(body.floor     !== undefined && { floor: body.floor !== "" ? parseInt(body.floor) : null }),
      ...(body.status    !== undefined && { status: body.status }),
      ...(body.ownerId   !== undefined && { ownerId: body.ownerId || null }),
      ...(body.notes     !== undefined && { notes: body.notes || null }),
    },
    include: { owner: { select: { id: true, prenom: true, nom: true, companyName: true } }, baux: true },
  });
  return NextResponse.json(lot);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.lot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
