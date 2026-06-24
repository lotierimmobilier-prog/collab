import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/mail/memory?email=xxx  → mémoire pour cet expéditeur
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ memory: null });

  const memory = await prisma.mailLabelMemory.findUnique({ where: { fromEmail: email } });
  return NextResponse.json({ memory });
}

// POST /api/mail/memory  { fromEmail, labelIds, assignedToId, note }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { fromEmail, labelIds, assignedToId, note } = await req.json();
  if (!fromEmail) return NextResponse.json({ error: "fromEmail requis" }, { status: 400 });

  const memory = await prisma.mailLabelMemory.upsert({
    where: { fromEmail },
    update: { labelIds: labelIds ?? [], assignedToId: assignedToId ?? null, note: note ?? null },
    create: { fromEmail, labelIds: labelIds ?? [], assignedToId: assignedToId ?? null, note: note ?? null },
  });
  return NextResponse.json({ memory });
}

// DELETE /api/mail/memory?email=xxx  → oublier cet expéditeur
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email requis" }, { status: 400 });

  await prisma.mailLabelMemory.deleteMany({ where: { fromEmail: email } });
  return NextResponse.json({ ok: true });
}
