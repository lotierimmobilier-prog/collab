import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isSuperAdminEmail } from "@/lib/superadmin";

const KEY = "menu_custom";

function isSuper(session: { user?: { superAdmin?: boolean; email?: string | null } } | null): boolean {
  return session?.user?.superAdmin === true || isSuperAdminEmail(session?.user?.email);
}

// GET — personnalisation du menu (labels / icônes / ordre). Lisible par tous les
// utilisateurs connectés pour que la barre latérale l'applique.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  let custom: Record<string, { label?: string; icon?: string; order?: number }> = {};
  try { custom = row?.value ? JSON.parse(row.value) : {}; } catch { custom = {}; }
  return NextResponse.json({ custom });
}

// POST — enregistre la personnalisation (super administrateur uniquement).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuper(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const custom = body?.custom && typeof body.custom === "object" ? body.custom : {};
  const value = JSON.stringify(custom).slice(0, 20000);
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
  return NextResponse.json({ ok: true });
}
