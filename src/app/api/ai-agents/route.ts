import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";
import { agentAllowed, isValidModel } from "@/lib/ai-agents";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAgent = any;

// GET /api/ai-agents — liste des assistants.
// Utilisateur : assistants actifs et autorisés pour son rôle (champs publics).
// Direction avec ?admin=1 : configuration complète (prompt, rôles, documents).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = session.user.roleId ?? "";
  const isDir = isDirectionRole(role);
  const admin = req.nextUrl.searchParams.get("admin") === "1" && isDir;

  const rows: AnyAgent[] = await prisma.aiAgent.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: admin ? { docs: { orderBy: { createdAt: "asc" } }, _count: { select: { chunks: true } } } : undefined,
  }).catch(() => []);

  if (admin) {
    return NextResponse.json({ isDir, admin: true, agents: rows });
  }

  const agents = rows
    .filter((a) => a.active && agentAllowed(a.accessRoles, role))
    .map((a) => ({
      id: a.id, name: a.name, specialty: a.specialty, description: a.description,
      icon: a.icon, color: a.color, photo: a.photo, cv: a.cv,
    }));
  return NextResponse.json({ isDir, agents });
}

// POST /api/ai-agents — créer un assistant (direction).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  let b: AnyAgent;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const name = (b.name || "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Nom trop court." }, { status: 400 });

  const created = await prisma.aiAgent.create({
    data: {
      name: name.slice(0, 80),
      specialty: (b.specialty || "").trim().slice(0, 120) || null,
      description: (b.description || "").trim().slice(0, 600) || null,
      icon: (b.icon || "🤖").trim().slice(0, 8),
      photo: (b.photo || "").trim().slice(0, 700000) || null,
      cv: (b.cv || "").trim().slice(0, 4000) || null,
      color: (b.color || "#B8966A").trim().slice(0, 16),
      model: isValidModel(b.model) ? b.model : "smart",
      systemPrompt: (b.systemPrompt || "").trim().slice(0, 12000),
      accessRoles: Array.isArray(b.accessRoles) && b.accessRoles.length ? b.accessRoles.map(String) : undefined,
      order: Number.isFinite(b.order) ? Number(b.order) : 0,
    },
  }).catch(() => null);
  if (!created) return NextResponse.json({ error: "Création impossible." }, { status: 500 });

  return NextResponse.json({ ok: true, id: created.id });
}
