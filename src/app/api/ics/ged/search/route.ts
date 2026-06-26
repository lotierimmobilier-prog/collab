import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessIcsGed } from "@/lib/ics";
import { getValidGedToken } from "@/lib/ics-ged-auth";
import { gedSearchGerance } from "@/lib/ics-ged";

export const runtime = "nodejs";

/** GET /api/ics/ged/search?q= — cherche un mandat/propriétaire par nom dans la GED. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canAccessIcsGed(session.user.roleId)) return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ folders: [] });

  const tk = await getValidGedToken();
  if (!tk.token) return NextResponse.json({ error: tk.error ?? "Accès GED indisponible." }, { status: 502 });

  const folders = await gedSearchGerance(tk.apiBase, tk.token, q);
  return NextResponse.json({ folders });
}
