import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

// DELETE /api/forum/replies/[id] — supprimer une réponse (auteur ou direction).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = (session.user as { id?: string }).id ?? "";
  const isDir = isDirectionRole(session.user.roleId ?? "");
  const { id } = await ctx.params;

  const reply = await prisma.forumReply.findUnique({ where: { id }, select: { userId: true } }).catch(() => null);
  if (!reply) return NextResponse.json({ ok: true });
  if (reply.userId !== uid && !isDir) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  await prisma.forumReply.delete({ where: { id } }).catch(() => {});
  await prisma.forumLike.deleteMany({ where: { kind: "reply", refId: id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
