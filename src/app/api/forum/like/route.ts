import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// POST /api/forum/like — bascule le « j'aime » de l'utilisateur courant.
// body: { kind: "topic" | "reply", refId }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id ?? "";

  let b: { kind?: string; refId?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const kind = b.kind === "reply" ? "reply" : b.kind === "topic" ? "topic" : null;
  const refId = (b.refId || "").trim();
  if (!kind || !refId) return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });

  const existing = await prisma.forumLike.findUnique({
    where: { kind_refId_userId: { kind, refId, userId } },
  }).catch(() => null);

  if (existing) {
    await prisma.forumLike.delete({ where: { id: existing.id } }).catch(() => {});
    return NextResponse.json({ ok: true, liked: false });
  }
  await prisma.forumLike.create({ data: { kind, refId, userId } }).catch(() => {});
  return NextResponse.json({ ok: true, liked: true });
}
