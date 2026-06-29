import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET /api/suggestions — liste des suggestions (visible par tous les utilisateurs
// connectés), avec le nombre de votes et si l'utilisateur courant a voté.
// Tri : votes décroissants puis plus récentes.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.suggestion.findMany({
    orderBy: [{ createdAt: "desc" }],
    include: { votes: { select: { userId: true } } },
  }).catch(() => []);

  const suggestions = rows.map((s) => ({
    id: s.id,
    userId: s.userId,
    userName: s.userName,
    title: s.title,
    description: s.description,
    category: s.category,
    status: s.status,
    adminNote: s.adminNote,
    createdAt: s.createdAt,
    votes: s.votes.length,
    hasVoted: s.votes.some((v: { userId: string }) => v.userId === userId),
    mine: s.userId === userId,
  })).sort((a, b) => b.votes - a.votes || (a.createdAt < b.createdAt ? 1 : -1));

  return NextResponse.json({ suggestions });
}

// POST /api/suggestions — créer une suggestion.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const u = session.user as { id?: string; prenom?: string; name?: string | null };
  const userId = u.id ?? "";

  let body: { title?: string; description?: string; category?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const title = (body.title || "").trim();
  if (title.length < 3) return NextResponse.json({ error: "Titre trop court." }, { status: 400 });

  const created = await prisma.suggestion.create({
    data: {
      userId,
      userName: u.prenom || u.name || "Utilisateur",
      title: title.slice(0, 160),
      description: (body.description || "").trim().slice(0, 4000) || null,
      category: ["fonctionnalite", "amelioration", "bug", "autre"].includes(body.category || "") ? body.category : "amelioration",
    },
  }).catch(() => null);
  if (!created) return NextResponse.json({ error: "Création impossible." }, { status: 500 });

  // L'auteur vote automatiquement pour sa propre idée.
  await prisma.suggestionVote.create({ data: { suggestionId: created.id, userId } }).catch(() => {});

  return NextResponse.json({ ok: true, id: created.id });
}
