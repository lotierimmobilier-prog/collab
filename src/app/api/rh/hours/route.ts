import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALIDATORS = ["admin", "dirigeant", "direction"];

// GET /api/rh/hours?scope=mine|all|tovalidate — relevés d'heures mensuels.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;
  const isValidator = VALIDATORS.includes(session.user.roleId ?? "");
  const scope = new URL(req.url).searchParams.get("scope") || "mine";
  if (scope !== "mine" && !isValidator) return NextResponse.json({ error: "Réservé à la direction." }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = scope === "mine" ? { userId: uid } : scope === "tovalidate" ? { status: "signe" } : {};
  try {
    const rows = await prisma.monthlyHours.findMany({ where, orderBy: { month: "desc" }, take: 300 });
    const ids = [...new Set(rows.map(r => r.userId))];
    const users = scope === "mine" ? [] : await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, prenom: true, nom: true } });
    const names = new Map(users.map(u => [u.id, `${u.prenom} ${u.nom}`.trim()]));
    return NextResponse.json(rows.map(r => ({
      ...r,
      who: r.userId === uid ? "Vous" : (names.get(r.userId) ?? "—"),
      agentSignedAt: r.agentSignedAt?.toISOString() ?? null,
      validatedAt: r.validatedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    })));
  } catch {
    return NextResponse.json([]); // table pas encore migrée
  }
}

// POST /api/rh/hours — enregistre le relevé du mois de l'utilisateur, avec
// éventuellement la signature. body: { month, totalHours, note, entries?, sign? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;

  const body = await req.json().catch(() => ({}));
  const month = String(body?.month ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "Mois invalide (AAAA-MM)." }, { status: 400 });

  try {
    const existing = await prisma.monthlyHours.findUnique({ where: { userId_month: { userId: uid, month } } });
    if (existing?.status === "valide") return NextResponse.json({ error: "Ce relevé est déjà validé et verrouillé." }, { status: 409 });

    const sign = !!body?.sign;
    const me = await prisma.user.findUnique({ where: { id: uid }, select: { prenom: true, nom: true } });
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base: any = {
      totalHours: body.totalHours != null && body.totalHours !== "" ? Number(body.totalHours) : null,
      note: body.note?.trim() || null,
      status: sign ? "signe" : "brouillon",
    };
    if (Array.isArray(body.entries)) base.entries = body.entries;
    if (sign) {
      base.agentSigned = true;
      base.agentSignedAt = new Date();
      base.agentSignatureName = String(body.signatureName || `${me?.prenom ?? ""} ${me?.nom ?? ""}`).trim() || null;
      base.agentSignatureIp = ip;
    }

    await prisma.monthlyHours.upsert({
      where: { userId_month: { userId: uid, month } },
      update: base,
      create: { userId: uid, month, ...base },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
