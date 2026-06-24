import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;
  const calls = await prisma.phoneCall.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json(calls);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;
  const body = await req.json();
  const call = await prisma.phoneCall.create({
    data: { id: crypto.randomUUID(), userId, contact: body.contact, phone: body.phone || null, direction: body.direction ?? "inbound", status: body.status ?? "to_call", subject: body.subject || null, notes: body.notes || null, calledAt: body.calledAt ? new Date(body.calledAt) : null },
  });
  return NextResponse.json(call, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;
  const { id, ...data } = await req.json();
  const call = await prisma.phoneCall.updateMany({ where: { id, userId }, data: { ...data, calledAt: data.calledAt ? new Date(data.calledAt) : null, updatedAt: new Date() } });
  return NextResponse.json(call);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;
  const { id } = await req.json();
  await prisma.phoneCall.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
