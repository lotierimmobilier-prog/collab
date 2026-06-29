import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";
import { MODEL_TIERS } from "@/lib/ai-agents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// PATCH /api/ai-agents/[id] — modifier la configuration d'un assistant (direction).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  let b: Any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const data: Any = {};
  if (typeof b.name === "string" && b.name.trim().length >= 2) data.name = b.name.trim().slice(0, 80);
  if (b.specialty !== undefined) data.specialty = (b.specialty || "").trim().slice(0, 120) || null;
  if (b.description !== undefined) data.description = (b.description || "").trim().slice(0, 600) || null;
  if (b.icon !== undefined) data.icon = (b.icon || "🤖").trim().slice(0, 8);
  if (b.photo !== undefined) data.photo = (b.photo || "").trim().slice(0, 700000) || null;
  if (b.cv !== undefined) data.cv = (b.cv || "").trim().slice(0, 4000) || null;
  if (b.color !== undefined) data.color = (b.color || "#B8966A").trim().slice(0, 16);
  if (b.model !== undefined && MODEL_TIERS[b.model]) data.model = b.model;
  if (b.systemPrompt !== undefined) data.systemPrompt = (b.systemPrompt || "").trim().slice(0, 12000);
  if (b.accessRoles !== undefined) data.accessRoles = Array.isArray(b.accessRoles) && b.accessRoles.length ? b.accessRoles.map(String) : null;
  if (typeof b.active === "boolean") data.active = b.active;
  if (b.order !== undefined && Number.isFinite(b.order)) data.order = Number(b.order);
  if (!Object.keys(data).length) return NextResponse.json({ error: "Rien à modifier." }, { status: 400 });

  await prisma.aiAgent.update({ where: { id }, data }).catch(() => {});
  return NextResponse.json({ ok: true });
}

// DELETE /api/ai-agents/[id] — supprimer un assistant et sa base (direction).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  await prisma.aiAgent.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
