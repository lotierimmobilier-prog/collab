import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/formation/competences/[id] — modifier une compétence (admin).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body?.title !== undefined) data.title = String(body.title).trim();
  if (body?.description !== undefined) data.description = body.description?.trim() || null;
  if (body?.order !== undefined) data.order = Number(body.order) || 0;
  try {
    const c = await prisma.trainingCompetence.update({ where: { id }, data });
    return NextResponse.json(c);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE /api/formation/competences/[id] — supprimer une compétence (admin).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.trainingCompetence.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
