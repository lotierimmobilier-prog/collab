import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const VALIDATORS = ["admin", "dirigeant", "direction"];

// Salarié de l'agence ? (résilient si la colonne isEmployee manque encore).
async function isEmployee(uid: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u: any = await prisma.user.findUnique({ where: { id: uid }, select: { isEmployee: true } });
    return !!u?.isEmployee;
  } catch { return false; }
}

function countDays(start: Date, end: Date, halfStart: boolean, halfEnd: boolean): number {
  let d = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (d < 1) d = 1;
  if (halfStart) d -= 0.5;
  if (halfEnd) d -= 0.5;
  return Math.max(0.5, d);
}

// GET /api/rh/leaves?scope=mine|all|pending — demandes de congés.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;
  const isValidator = VALIDATORS.includes(session.user.roleId ?? "");
  const scope = new URL(req.url).searchParams.get("scope") || "mine";
  if (scope !== "mine" && !isValidator) return NextResponse.json({ error: "Réservé à la direction." }, { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = scope === "mine" ? { userId: uid } : scope === "pending" ? { status: "en_attente" } : {};
  try {
    const rows = await prisma.leaveRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 300 });
    const ids = [...new Set(rows.map(r => r.userId))];
    const users = scope === "mine" ? [] : await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, prenom: true, nom: true } });
    const names = new Map(users.map(u => [u.id, `${u.prenom} ${u.nom}`.trim()]));
    return NextResponse.json(rows.map(r => ({
      ...r,
      who: r.userId === uid ? "Vous" : (names.get(r.userId) ?? "—"),
      startDate: r.startDate.toISOString(), endDate: r.endDate.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null, createdAt: r.createdAt.toISOString(),
    })));
  } catch {
    return NextResponse.json([]); // table pas encore migrée
  }
}

// POST /api/rh/leaves — créer une demande (statut « en_attente »).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  // Réservé aux collaborateurs salariés de l'agence.
  if (!(await isEmployee(session.user.id))) return NextResponse.json({ error: "Module réservé aux salariés de l'agence." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (!body?.startDate || !body?.endDate) return NextResponse.json({ error: "Dates requises." }, { status: 400 });
  const start = new Date(body.startDate), end = new Date(body.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return NextResponse.json({ error: "Dates invalides." }, { status: 400 });

  const halfStart = !!body.halfDayStart, halfEnd = !!body.halfDayEnd;
  try {
    const r = await prisma.leaveRequest.create({
      data: {
        userId: session.user.id,
        type: String(body.type || "conges_payes"),
        startDate: start, endDate: end, halfDayStart: halfStart, halfDayEnd: halfEnd,
        days: countDays(start, end, halfStart, halfEnd),
        reason: body.reason?.trim() || null,
        status: "en_attente",
      },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: r.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
