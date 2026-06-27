import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setExtras } from "@/lib/user-extras";

// POST /api/me/city — l'utilisateur définit sa propre ville de résidence
// (stockée dans user_extras). body: { city: string }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const city = String(body?.city ?? "").trim().slice(0, 80) || null;
  try {
    await setExtras(session.user.id, { city });
    return NextResponse.json({ ok: true, city });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
