import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta } from "@/lib/comptabilite";

// POST — enregistre les garanties financières (gestion / syndic) et l'utilisateur
// à alerter en cas de dépassement. { gestion, syndic, notifyUserId }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canAccessCompta((session.user as { roleId?: string }).roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const set = async (key: string, value: string) => prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  if (body.gestion !== undefined) await set("treso_garantie_gestion", String(Number(body.gestion) || 0));
  if (body.syndic !== undefined) await set("treso_garantie_syndic", String(Number(body.syndic) || 0));
  if (body.notifyUserId !== undefined) await set("treso_notify_user", String(body.notifyUserId || ""));
  return NextResponse.json({ ok: true });
}
