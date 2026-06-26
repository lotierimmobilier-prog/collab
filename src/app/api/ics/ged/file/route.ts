import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { gedDocAllowed } from "@/lib/ics";
import { getValidGedToken, gedLevelForUser } from "@/lib/ics-ged-auth";
import { gedFile } from "@/lib/ics-ged";

export const runtime = "nodejs";

/** GET /api/ics/ged/file?emplacement=&guid=&name= — sert le document GED (sans le stocker). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const level = await gedLevelForUser(session.user.id);
  if (level === "none") return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });

  const emplacement = req.nextUrl.searchParams.get("emplacement");
  const guid = req.nextUrl.searchParams.get("guid");
  const name = req.nextUrl.searchParams.get("name") || "document.pdf";
  if (!emplacement || !guid) return NextResponse.json({ error: "Paramètres manquants." }, { status: 400 });
  if (!gedDocAllowed(name, level)) return NextResponse.json({ error: "Document non autorisé pour votre niveau d'accès (bail et état des lieux uniquement)." }, { status: 403 });

  const tk = await getValidGedToken();
  if (!tk.token) return NextResponse.json({ error: tk.error ?? "Accès GED indisponible." }, { status: 502 });

  const res = await gedFile(tk.apiBase, tk.token, emplacement, guid);
  if (!res.ok || !res.body) return NextResponse.json({ error: `Document indisponible (HTTP ${res.status}).` }, { status: 502 });

  const ct = res.headers.get("content-type") || (name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
  const safe = name.replace(/[^\w.\-]/g, "_");
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": ct,
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
