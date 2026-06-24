import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;
  const notes = await prisma.personalNote.findMany({ where: { userId }, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;
  const { content, color, pinned } = await req.json();
  const note = await prisma.personalNote.create({ data: { id: crypto.randomUUID(), userId, content: content || "", color: color || "#FFFBEB", pinned: pinned ?? false } });
  return NextResponse.json(note, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;
  const { id, content, color, pinned } = await req.json();
  const note = await prisma.personalNote.updateMany({ where: { id, userId }, data: { content, color, pinned, updatedAt: new Date() } });
  return NextResponse.json(note);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;
  const { id } = await req.json();
  await prisma.personalNote.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
