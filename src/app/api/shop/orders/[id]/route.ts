import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

const STATUSES = ["nouveau", "preparation", "pret", "remis", "annule"];

// PATCH /api/shop/orders/[id] — faire évoluer le statut d'une commande (direction).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  let body: { status?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  if (!body.status || !STATUSES.includes(body.status)) return NextResponse.json({ error: "Statut invalide." }, { status: 400 });

  await prisma.shopOrder.update({ where: { id }, data: { status: body.status } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

// DELETE /api/shop/orders/[id] — l'auteur (commande encore "nouveau") ou la
// direction peut supprimer/annuler une commande.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id ?? "";
  const isDir = isDirectionRole(session.user.roleId ?? "");
  const { id } = await ctx.params;

  const o = await prisma.shopOrder.findUnique({ where: { id }, select: { userId: true, status: true } }).catch(() => null);
  if (!o) return NextResponse.json({ ok: true });
  const ownPending = o.userId === userId && o.status === "nouveau";
  if (!isDir && !ownPending) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  await prisma.shopOrder.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
