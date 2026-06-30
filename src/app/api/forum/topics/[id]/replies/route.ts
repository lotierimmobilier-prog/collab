import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

// POST /api/forum/topics/[id]/replies — répondre à un sujet. body: { body }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const u = session.user as { id?: string; prenom?: string; name?: string | null };
  const isDir = isDirectionRole(session.user.roleId ?? "");
  const { id } = await ctx.params;

  const topic = await prisma.forumTopic.findUnique({ where: { id }, select: { locked: true } }).catch(() => null);
  if (!topic) return NextResponse.json({ error: "Sujet introuvable." }, { status: 404 });
  if (topic.locked && !isDir) return NextResponse.json({ error: "Ce sujet est verrouillé." }, { status: 403 });

  let b: { body?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const body = (b.body || "").trim();
  if (body.length < 1) return NextResponse.json({ error: "Message vide." }, { status: 400 });

  const created = await prisma.forumReply.create({
    data: { topicId: id, userId: u.id ?? "", userName: u.prenom || u.name || "Utilisateur", body: body.slice(0, 8000) },
  }).catch(() => null);
  if (!created) return NextResponse.json({ error: "Réponse impossible." }, { status: 500 });

  await prisma.forumTopic.update({ where: { id }, data: { lastReplyAt: created.createdAt } }).catch(() => {});
  return NextResponse.json({ ok: true, id: created.id });
}
