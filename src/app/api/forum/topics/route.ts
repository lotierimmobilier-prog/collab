import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// GET /api/forum/topics?category=<id> — sujets d'une catégorie (épinglés en tête,
// puis par dernière activité). Inclut le nombre de réponses et de « j'aime ».
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const categoryId = req.nextUrl.searchParams.get("category") || undefined;

  const topics: Any[] = await prisma.forumTopic.findMany({
    where: categoryId ? { categoryId } : {},
    orderBy: [{ pinned: "desc" }, { lastReplyAt: "desc" }],
    include: { _count: { select: { replies: true } } },
    take: 200,
  }).catch(() => []);

  // Compteurs de « j'aime » des sujets.
  const ids = topics.map(t => t.id);
  const likeRows: Any[] = ids.length
    ? await prisma.forumLike.groupBy({ by: ["refId"], where: { kind: "topic", refId: { in: ids } }, _count: { refId: true } }).catch(() => [])
    : [];
  const likeMap = new Map<string, number>(likeRows.map(r => [r.refId, r._count.refId]));

  return NextResponse.json({
    topics: topics.map(t => ({
      id: t.id, categoryId: t.categoryId, userName: t.userName, title: t.title,
      pinned: t.pinned, locked: t.locked, createdAt: t.createdAt, lastReplyAt: t.lastReplyAt,
      replyCount: t._count?.replies ?? 0, likeCount: likeMap.get(t.id) ?? 0,
    })),
  });
}

// POST /api/forum/topics — créer un sujet. body: { categoryId, title, body }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const u = session.user as { id?: string; prenom?: string; name?: string | null };

  let b: { categoryId?: string; title?: string; body?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const title = (b.title || "").trim();
  const body = (b.body || "").trim();
  if (title.length < 3) return NextResponse.json({ error: "Titre trop court." }, { status: 400 });
  if (body.length < 1) return NextResponse.json({ error: "Message vide." }, { status: 400 });

  const cat = await prisma.forumCategory.findFirst({ where: { id: b.categoryId, active: true }, select: { id: true } }).catch(() => null);
  if (!cat) return NextResponse.json({ error: "Catégorie introuvable." }, { status: 400 });

  const created = await prisma.forumTopic.create({
    data: {
      categoryId: cat.id,
      userId: u.id ?? "",
      userName: u.prenom || u.name || "Utilisateur",
      title: title.slice(0, 160),
      body: body.slice(0, 8000),
    },
  }).catch(() => null);
  if (!created) return NextResponse.json({ error: "Création impossible." }, { status: 500 });
  return NextResponse.json({ ok: true, id: created.id });
}
