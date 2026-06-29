import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

const STATUSES = ["nouveau", "a_l_etude", "planifie", "realise", "refuse"];

// PATCH /api/suggestions/[id] — l'administration/direction fait évoluer le
// statut et peut ajouter une réponse.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  let body: { status?: string; adminNote?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body.status && STATUSES.includes(body.status)) data.status = body.status;
  if (body.adminNote !== undefined) data.adminNote = (body.adminNote || "").trim().slice(0, 2000) || null;
  if (!Object.keys(data).length) return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });

  await prisma.suggestion.update({ where: { id }, data }).catch(() => {});
  return NextResponse.json({ ok: true });
}

// DELETE /api/suggestions/[id] — l'auteur ou la direction peut supprimer.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id ?? "";
  const { id } = await ctx.params;

  const s = await prisma.suggestion.findUnique({ where: { id }, select: { userId: true } }).catch(() => null);
  if (!s) return NextResponse.json({ ok: true });
  if (s.userId !== userId && !isDirectionRole(session.user.roleId ?? "")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  await prisma.suggestion.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
