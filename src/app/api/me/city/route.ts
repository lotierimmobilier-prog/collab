import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { saveUser } from "@/lib/user-write";

// POST /api/me/city — l'utilisateur définit sa propre ville de résidence.
// body: { city: string }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const city = String(body?.city ?? "").trim().slice(0, 80) || null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { city };
    await saveUser(() => prisma.user.update({ where: { id: session.user.id }, data, select: { id: true } }), data);
    return NextResponse.json({ ok: true, city });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
