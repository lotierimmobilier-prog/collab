import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

// GET /api/forum/topics/[id] — sujet + réponses + compteurs de « j'aime ».
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = (session.user as { id?: string }).id ?? "";
  const isDir = isDirectionRole(session.user.roleId ?? "");
  const { id } = await ctx.params;

  const topic: Any = await prisma.forumTopic.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true, icon: true, color: true } }, replies: { orderBy: { createdAt: "asc" } } },
  }).catch(() => null);
  if (!topic) return NextResponse.json({ error: "Sujet introuvable." }, { status: 404 });

  // Compteurs de « j'aime » et états « j'ai aimé » (sujet + réponses).
  const refIds = [topic.id, ...topic.replies.map((r: Any) => r.id)];
  const likeRows: Any[] = await prisma.forumLike.groupBy({ by: ["refId"], where: { refId: { in: refIds } }, _count: { refId: true } }).catch(() => []);
  const counts = new Map<string, number>(likeRows.map(r => [r.refId, r._count.refId]));
  const mine: Any[] = await prisma.forumLike.findMany({ where: { userId: uid, refId: { in: refIds } }, select: { refId: true } }).catch(() => []);
  const liked = new Set<string>(mine.map(m => m.refId));

  return NextResponse.json({
    isDir, currentUserId: uid,
    topic: {
      id: topic.id, title: topic.title, body: topic.body, userId: topic.userId, userName: topic.userName,
      pinned: topic.pinned, locked: topic.locked, createdAt: topic.createdAt,
      category: topic.category,
      likeCount: counts.get(topic.id) ?? 0, hasLiked: liked.has(topic.id),
      replies: topic.replies.map((r: Any) => ({
        id: r.id, userId: r.userId, userName: r.userName, body: r.body, createdAt: r.createdAt,
        likeCount: counts.get(r.id) ?? 0, hasLiked: liked.has(r.id),
      })),
    },
  });
}

// PATCH /api/forum/topics/[id] — épingler/verrouiller (direction) ou éditer
// (auteur ou direction).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = (session.user as { id?: string }).id ?? "";
  const isDir = isDirectionRole(session.user.roleId ?? "");
  const { id } = await ctx.params;

  const topic = await prisma.forumTopic.findUnique({ where: { id }, select: { userId: true } }).catch(() => null);
  if (!topic) return NextResponse.json({ error: "Sujet introuvable." }, { status: 404 });

  let b: Any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const data: Any = {};
  // Modération : direction uniquement.
  if (typeof b.pinned === "boolean" && isDir) data.pinned = b.pinned;
  if (typeof b.locked === "boolean" && isDir) data.locked = b.locked;
  // Édition du contenu : auteur ou direction.
  const canEdit = isDir || topic.userId === uid;
  if (canEdit) {
    if (typeof b.title === "string" && b.title.trim().length >= 3) data.title = b.title.trim().slice(0, 160);
    if (typeof b.body === "string" && b.body.trim().length >= 1) data.body = b.body.trim().slice(0, 8000);
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Aucune modification autorisée." }, { status: 403 });

  await prisma.forumTopic.update({ where: { id }, data }).catch(() => {});
  return NextResponse.json({ ok: true });
}

// DELETE /api/forum/topics/[id] — supprimer (auteur ou direction).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = (session.user as { id?: string }).id ?? "";
  const isDir = isDirectionRole(session.user.roleId ?? "");
  const { id } = await ctx.params;

  const topic = await prisma.forumTopic.findUnique({ where: { id }, select: { userId: true } }).catch(() => null);
  if (!topic) return NextResponse.json({ ok: true });
  if (topic.userId !== uid && !isDir) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  await prisma.forumTopic.delete({ where: { id } }).catch(() => {});
  // Nettoyage des « j'aime » du sujet (les réponses partent en cascade).
  await prisma.forumLike.deleteMany({ where: { kind: "topic", refId: id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
