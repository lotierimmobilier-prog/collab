import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALIDATORS = ["admin", "dirigeant", "direction"];

// PATCH /api/rh/leaves/[id] — décision direction (approve/reject) ou annulation
// par le demandeur. body: { action: "approve"|"reject"|"cancel", note? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;
  const isValidator = VALIDATORS.includes(session.user.roleId ?? "");
  const { id } = await params;

  const leave = await prisma.leaveRequest.findUnique({ where: { id } });
  if (!leave) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (action === "cancel") {
    if (leave.userId !== uid && !isValidator) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    await prisma.leaveRequest.update({ where: { id }, data: { status: "annule" } });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve" || action === "reject") {
    if (!isValidator) return NextResponse.json({ error: "Réservé à la direction." }, { status: 403 });
    await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: action === "approve" ? "approuve" : "refuse",
        decidedById: uid, decidedAt: new Date(),
        decisionNote: body?.note?.trim() || null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}

// DELETE /api/rh/leaves/[id] — le demandeur supprime sa demande en attente.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;
  const isValidator = VALIDATORS.includes(session.user.roleId ?? "");
  const { id } = await params;
  const leave = await prisma.leaveRequest.findUnique({ where: { id }, select: { userId: true } });
  if (!leave) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (leave.userId !== uid && !isValidator) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  await prisma.leaveRequest.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
