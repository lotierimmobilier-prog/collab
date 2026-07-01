import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// QCM du parrain : auto-évaluation privée. Les réponses sont rattachées au
// parrain (session) et ne sont JAMAIS exposées à ses filleuls (aucun endpoint
// ne permet de lire le QCM d'un autre utilisateur).

// GET — mes réponses (parrain courant).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  let rows: { competenceId: string; quiz: unknown }[] = [];
  try {
    rows = await prisma.$queryRawUnsafe(
      `SELECT "competenceId", quiz FROM parrain_quiz_results WHERE "parrainId" = $1`, session.user.id,
    );
  } catch { /* table absente → vide */ }
  return NextResponse.json({ results: rows });
}

// POST { competenceId, quiz } — enregistre/écrase mes réponses pour une compétence.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { competenceId, quiz } = await req.json().catch(() => ({}));
  if (!competenceId || typeof competenceId !== "string") return NextResponse.json({ error: "competenceId requis" }, { status: 400 });
  const q = quiz && typeof quiz === "object" ? quiz : {};
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO parrain_quiz_results (id, "parrainId", "competenceId", quiz, "updatedAt")
         VALUES ($1, $2, $3, $4::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT ("parrainId", "competenceId")
         DO UPDATE SET quiz = EXCLUDED.quiz, "updatedAt" = CURRENT_TIMESTAMP`,
      randomUUID(), session.user.id, competenceId, JSON.stringify(q),
    );
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, competenceId, quiz: q });
}
