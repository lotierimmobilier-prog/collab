import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// POST /api/suggestions/[id]/vote — bascule le vote de l'utilisateur courant.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id ?? "";
  const { id } = await ctx.params;

  const existing = await prisma.suggestionVote.findUnique({
    where: { suggestionId_userId: { suggestionId: id, userId } },
  }).catch(() => null);

  if (existing) {
    await prisma.suggestionVote.delete({ where: { id: existing.id } }).catch(() => {});
    return NextResponse.json({ ok: true, voted: false });
  }
  await prisma.suggestionVote.create({ data: { suggestionId: id, userId } }).catch(() => {});
  return NextResponse.json({ ok: true, voted: true });
}
