import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const docs = await prisma.knowledgeDoc.findMany({
    where: { ...(category ? { category } : {}), active: true },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, category: true, fileName: true, fileSize: true, active: true, createdAt: true, content: true },
  });
  return NextResponse.json(docs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id!;
  const { title, category, content, fileName, fileSize } = await req.json();
  if (!title || !content) return NextResponse.json({ error: "title et content requis" }, { status: 400 });
  const doc = await prisma.knowledgeDoc.create({
    data: { id: crypto.randomUUID(), title, category: category ?? "general", content, fileName: fileName ?? null, fileSize: fileSize ?? null, createdBy: userId },
  });
  return NextResponse.json(doc, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id, title, category, content, active } = await req.json();
  const doc = await prisma.knowledgeDoc.update({ where: { id }, data: { title, category, content, active, updatedAt: new Date() } });
  return NextResponse.json(doc);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await req.json();
  await prisma.knowledgeDoc.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
