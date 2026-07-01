import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fetchFeed, analyzeFeed } from "@/lib/veille";

// POST { feedId } — ré-analyse immédiate d'un flux (bouton « Analyser »).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { feedId } = await req.json().catch(() => ({}));
  if (!feedId) return NextResponse.json({ error: "feedId requis" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.$queryRawUnsafe(`SELECT id, title, url FROM veille_feed WHERE id = $1`, String(feedId)).catch(() => []);
  const feed = rows[0];
  if (!feed) return NextResponse.json({ error: "Flux introuvable" }, { status: 404 });

  try {
    const items = await fetchFeed(feed.url);
    const analysis = await analyzeFeed(feed.title, items);
    await prisma.$executeRawUnsafe(
      `UPDATE veille_feed SET items = $1::jsonb, analysis = $2, "lastAnalyzedAt" = CURRENT_TIMESTAMP, "lastError" = NULL WHERE id = $3`,
      JSON.stringify(items), analysis, feed.id,
    );
    return NextResponse.json({ ok: true, items, analysis });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.$executeRawUnsafe(`UPDATE veille_feed SET "lastError" = $1, "lastAnalyzedAt" = CURRENT_TIMESTAMP WHERE id = $2`, msg, feed.id).catch(() => {});
    return NextResponse.json({ ok: false, error: msg });
  }
}
