import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { gedDocAllowed } from "@/lib/ics";
import { getValidGedToken, gedLevelForUser } from "@/lib/ics-ged-auth";
import { gedRoot, gedFolder } from "@/lib/ics-ged";

export const runtime = "nodejs";

interface Son { idArbo: number; nom: string; nomGed: string; type?: string; documentsCount?: number; foldersCount?: number; infos?: { nompr?: string; type?: string } }
interface Doc { guid: string; nom: string; extension?: string; size?: number; emplacement: string; dateUpload?: string }

/** GET /api/ics/ged/browse?id=&nomGed= — contenu d'un dossier GED (racine si pas d'id). */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const level = await gedLevelForUser(session.user.id);
  if (level === "none") return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });

  const tk = await getValidGedToken();
  if (!tk.token) return NextResponse.json({ error: tk.error ?? "Accès GED indisponible." }, { status: 502 });

  const idStr = req.nextUrl.searchParams.get("id");
  const nomGed = req.nextUrl.searchParams.get("nomGed") ?? "";

  const r = idStr
    ? await gedFolder(tk.apiBase, tk.token, Number(idStr), nomGed)
    : await gedRoot(tk.apiBase, tk.token);

  if (r.responseCode !== "200") return NextResponse.json({ error: r.msg || "Dossier inaccessible." }, { status: 502 });

  const pl = (r.payload ?? {}) as { directory?: { idArbo: number; nom: string; nomGed: string; cheminComplet?: string; infos?: { nompr?: string; type?: string } }; sons?: Son[]; docs?: Doc[] };
  const folders = (pl.sons ?? []).map(s => ({ idArbo: s.idArbo, nom: s.infos?.nompr || s.nom, nomGed: s.nomGed, type: s.infos?.type || s.type, count: (s.documentsCount ?? 0) + (s.foldersCount ?? 0) }));
  const docs = (pl.docs ?? [])
    .filter(d => gedDocAllowed(d.nom, level))   // accès restreint : bail + EDL seulement
    .map(d => ({ guid: d.guid, nom: d.nom, extension: d.extension, size: d.size, emplacement: d.emplacement, dateUpload: d.dateUpload }));

  return NextResponse.json({
    directory: pl.directory ? { idArbo: pl.directory.idArbo, nom: pl.directory.infos?.nompr || pl.directory.nom, path: pl.directory.cheminComplet } : null,
    folders, docs,
  });
}
