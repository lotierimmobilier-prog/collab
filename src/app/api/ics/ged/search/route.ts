import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getValidGedToken, gedLevelForUser } from "@/lib/ics-ged-auth";
import { gedSearchGerance, GedMatch } from "@/lib/ics-ged";

export const runtime = "nodejs";

/** GET /api/ics/ged/search?q= — cherche un mandat/propriétaire par nom. Résout
 *  aussi un locataire → son propriétaire via l'index (la GED est rangée par
 *  propriétaire). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (await gedLevelForUser(session.user.id) === "none") return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ folders: [] });

  const tk = await getValidGedToken();
  if (!tk.token) return NextResponse.json({ error: tk.error ?? "Accès GED indisponible." }, { status: 502 });

  // Résolution via l'index : si le terme correspond à un locataire, on cherche
  // aussi le(s) propriétaire(s) associé(s).
  const terms = q.split(/\s+/).filter(t => t.length >= 2).slice(0, 4);
  const orConds = terms.flatMap(t => [
    { nomLocataire: { contains: t, mode: "insensitive" as const } },
    { prenomLocataire: { contains: t, mode: "insensitive" as const } },
  ]);
  const matches = orConds.length
    ? await prisma.icsTenant.findMany({ where: { OR: orConds }, take: 15, select: { nomProprietaire: true } })
    : [];
  const ownerNames = [...new Set(matches.map((m: { nomProprietaire: string | null }) => m.nomProprietaire).filter(Boolean) as string[])];

  const names = [q, ...ownerNames].slice(0, 4);
  const all: GedMatch[] = [];
  const seen = new Set<number>();
  for (const n of names) {
    const found = await gedSearchGerance(tk.apiBase, tk.token, n);
    for (const f of found) if (!seen.has(f.idArbo)) { seen.add(f.idArbo); all.push(f); }
    if (all.length >= 40) break;
  }
  return NextResponse.json({ folders: all });
}
