import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/formation/questions/[id] — modifier une question (admin).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body?.prompt !== undefined) data.prompt = String(body.prompt).trim();
  if (body?.explanation !== undefined) data.explanation = body.explanation?.trim() || null;
  if (body?.order !== undefined) data.order = Number(body.order) || 0;
  if (body?.choices !== undefined) {
    const choices = Array.isArray(body.choices) ? body.choices.map((c: unknown) => String(c).trim()).filter(Boolean) : [];
    if (choices.length < 2) return NextResponse.json({ error: "Au moins deux réponses sont nécessaires" }, { status: 400 });
    data.choices = choices;
    let ci = Number(body?.correctIndex);
    if (!Number.isInteger(ci) || ci < 0 || ci >= choices.length) ci = 0;
    data.correctIndex = ci;
  } else if (body?.correctIndex !== undefined) {
    data.correctIndex = Number(body.correctIndex) || 0;
  }

  try {
    const q = await prisma.trainingQuestion.update({ where: { id }, data });
    return NextResponse.json(q);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE /api/formation/questions/[id] — supprimer une question (admin).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const { id } = await params;
  try {
    await prisma.trainingQuestion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
