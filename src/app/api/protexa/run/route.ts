import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isSuperAdminEmail } from "@/lib/superadmin";

// Déclenchement de la synchronisation Protexa depuis le tableau de bord.
// L'app ne peut pas lancer elle-même le robot Playwright (il tourne sur le VPS,
// avec Chromium + identifiants). Ce point d'entrée pose un « drapeau de demande »
// (réglage protexa_sync_request) ; un petit script sur le VPS interroge ce
// drapeau et lance le robot, qui pousse ensuite les données via /api/protexa/sync.

function isSuper(session: { user?: { superAdmin?: boolean; email?: string | null } } | null): boolean {
  return session?.user?.superAdmin === true || isSuperAdminEmail(session?.user?.email);
}

async function setting(key: string): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key } }).catch(() => null);
  return s?.value ?? "";
}

// GET — état de la synchro (dernière synchro, demande en attente).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuper(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });

  const lastSync = await setting("protexa_synced_at");
  const requestedAt = await setting("protexa_sync_request");
  return NextResponse.json({ lastSync: lastSync || null, requestedAt: requestedAt || null, pending: !!requestedAt });
}

// POST — demander une synchronisation (pose le drapeau).
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuper(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });

  const now = new Date().toISOString();
  await prisma.setting.upsert({
    where: { key: "protexa_sync_request" },
    create: { key: "protexa_sync_request", value: now },
    update: { value: now },
  }).catch(() => {});

  return NextResponse.json({ ok: true, requestedAt: now });
}
