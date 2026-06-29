import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

const CATEGORIES = ["textile", "accessoire", "bureau", "autre"];

// PATCH /api/shop/products/[id] — modifier un article (direction).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  let body: { name?: string; description?: string; price?: number; category?: string; image?: string; active?: boolean; order?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (typeof body.name === "string" && body.name.trim().length >= 2) data.name = body.name.trim().slice(0, 120);
  if (body.description !== undefined) data.description = (body.description || "").trim().slice(0, 1000) || null;
  if (body.price !== undefined) data.price = Math.max(0, Math.round((Number(body.price) || 0) * 100) / 100);
  if (body.category && CATEGORIES.includes(body.category)) data.category = body.category;
  if (body.image !== undefined) data.image = (body.image || "").trim().slice(0, 500) || null;
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.order !== undefined && Number.isFinite(body.order)) data.order = Number(body.order);
  if (!Object.keys(data).length) return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });

  await prisma.shopProduct.update({ where: { id }, data }).catch(() => {});
  return NextResponse.json({ ok: true });
}

// DELETE /api/shop/products/[id] — supprimer un article (direction).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  await prisma.shopProduct.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
