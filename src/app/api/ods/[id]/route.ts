import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const order = await prisma.serviceOrder.update({
    where: { id },
    data: {
      ...(body.status      !== undefined && { status: body.status }),
      ...(body.title       !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.address     !== undefined && { address: body.address || null }),
      ...(body.deadline    !== undefined && { deadline: body.deadline ? new Date(body.deadline) : null }),
      ...(body.amount      !== undefined && { amount: body.amount ? parseFloat(body.amount) : null }),
      ...(body.notes       !== undefined && { notes: body.notes || null }),
      ...(body.supplierId  !== undefined && { supplierId: body.supplierId }),
    },
    include: { supplier: { select: { id: true, name: true, type: true } } },
  });

  return NextResponse.json({
    ...order,
    deadline:  order.deadline?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.serviceOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
