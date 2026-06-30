import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// GET /api/forum/categories — catégories du forum (+ nombre de sujets).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const isDir = isDirectionRole(session.user.roleId ?? "");
  const all = req.nextUrl.searchParams.get("all") === "1" && isDir;

  const rows: Any[] = await prisma.forumCategory.findMany({
    where: all ? {} : { active: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { topics: true } } },
  }).catch(() => []);

  return NextResponse.json({
    isDir,
    categories: rows.map(c => ({
      id: c.id, name: c.name, description: c.description, icon: c.icon, color: c.color,
      order: c.order, active: c.active, topicCount: c._count?.topics ?? 0,
    })),
  });
}

// POST /api/forum/categories — créer une catégorie (direction).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  let b: Any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const name = (b.name || "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Nom trop court." }, { status: 400 });

  const created = await prisma.forumCategory.create({
    data: {
      name: name.slice(0, 80),
      description: (b.description || "").trim().slice(0, 300) || null,
      icon: (b.icon || "💬").trim().slice(0, 8),
      color: (b.color || "#B8966A").trim().slice(0, 16),
      order: Number.isFinite(b.order) ? Number(b.order) : 0,
    },
  }).catch(() => null);
  if (!created) return NextResponse.json({ error: "Création impossible." }, { status: 500 });
  return NextResponse.json({ ok: true, id: created.id });
}
