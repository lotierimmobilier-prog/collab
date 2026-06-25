import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PERF_TYPE_IDS, quarterBoundsFromKey } from "@/lib/performance";

function isAdmin(roleId?: string) { return roleId === "admin" || roleId === "dirigeant"; }

/** GET /api/admin/performance?quarter=2026-T2  → entrées (admin/direction). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.roleId))
    return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });

  const quarter = req.nextUrl.searchParams.get("quarter") || "";
  const bounds = quarterBoundsFromKey(quarter);

  const entries = await prisma.performanceEntry.findMany({
    where: bounds ? { date: { gte: bounds.start, lt: bounds.end } } : {},
    orderBy: { date: "desc" },
    take: 500,
  });

  return NextResponse.json({
    entries: entries.map(e => ({ ...e, date: e.date.toISOString(), createdAt: e.createdAt.toISOString() })),
  });
}

/** POST /api/admin/performance  { userId, type, date, label?, amount? } */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.roleId))
    return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });

  const { userId, type, date, label, amount } = await req.json();
  if (!userId || !type || !date)
    return NextResponse.json({ error: "userId, type et date sont requis" }, { status: 400 });
  if (!PERF_TYPE_IDS.includes(type))
    return NextResponse.json({ error: "Type d'opération invalide" }, { status: 400 });

  const entry = await prisma.performanceEntry.create({
    data: {
      userId,
      type,
      label: label?.trim() || null,
      amount: amount != null && amount !== "" ? Number(amount) : null,
      date: new Date(date),
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ ...entry, date: entry.date.toISOString(), createdAt: entry.createdAt.toISOString() }, { status: 201 });
}

/** DELETE /api/admin/performance?id=  */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.roleId))
    return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await prisma.performanceEntry.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
