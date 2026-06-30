import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// PATCH /api/forum/categories/[id] — modifier une catégorie (direction).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  let b: Any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const data: Any = {};
  if (typeof b.name === "string" && b.name.trim().length >= 2) data.name = b.name.trim().slice(0, 80);
  if (b.description !== undefined) data.description = (b.description || "").trim().slice(0, 300) || null;
  if (b.icon !== undefined) data.icon = (b.icon || "💬").trim().slice(0, 8);
  if (b.color !== undefined) data.color = (b.color || "#B8966A").trim().slice(0, 16);
  if (typeof b.active === "boolean") data.active = b.active;
  if (b.order !== undefined && Number.isFinite(b.order)) data.order = Number(b.order);
  if (!Object.keys(data).length) return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });

  await prisma.forumCategory.update({ where: { id }, data }).catch(() => {});
  return NextResponse.json({ ok: true });
}

// DELETE /api/forum/categories/[id] — supprimer une catégorie et ses sujets (direction).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  await prisma.forumCategory.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
