import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Signature d'email PAR utilisateur et PAR compte (même sur une boîte partagée).
// GET /api/mail/signature?accountId=… → { signature }
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const accountId = req.nextUrl.searchParams.get("accountId") || "";
  if (!accountId) return NextResponse.json({ signature: null });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT signature FROM mail_signatures WHERE "userId" = $1 AND "accountId" = $2 LIMIT 1`,
      session.user.id, accountId,
    );
    return NextResponse.json({ signature: rows[0]?.signature ?? null });
  } catch { return NextResponse.json({ signature: null }); }
}

// POST { accountId, signature } → enregistre la signature de l'utilisateur courant.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { accountId, signature } = await req.json().catch(() => ({}));
  if (!accountId || typeof accountId !== "string") return NextResponse.json({ error: "accountId requis" }, { status: 400 });
  const sig = typeof signature === "string" ? signature : "";
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO mail_signatures (id, "userId", "accountId", signature, "updatedAt")
         VALUES ($1, $2, $3, $4, now())
       ON CONFLICT ("userId", "accountId")
         DO UPDATE SET signature = EXCLUDED.signature, "updatedAt" = now()`,
      randomUUID(), session.user.id, accountId, sig,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
