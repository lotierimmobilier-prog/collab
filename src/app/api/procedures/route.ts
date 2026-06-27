import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
const MAX_BYTES = 50 * 1024 * 1024; // 50 Mo (vidéos courtes ; sinon utiliser un lien)

// GET /api/procedures — liste des procédures.
// Cloisonnement par rôle : chacun voit les procédures « tout le monde » (roles
// vide) + celles ciblant son rôle ; l'admin voit tout (avec les rôles ciblés).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const role = session.user.roleId ?? "";
  const isAdmin = role === "admin";

  try {
    const where = isAdmin ? {} : { OR: [{ roles: { isEmpty: true } }, { roles: { has: role } }] };
    const rows = await prisma.procedure.findMany({
      where,
      select: { id: true, title: true, description: true, category: true, kind: true, roles: true, fileName: true, mime: true, size: true, url: true, createdAt: true, updatedAt: true },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });
    return NextResponse.json(rows.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      hasFile: !!p.fileName,
    })));
  } catch {
    return NextResponse.json([]); // table/colonne pas encore migrée
  }
}

// POST /api/procedures — créer (ADMIN uniquement).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Titre requis." }, { status: 400 });

  const file = body?.file;
  if (file?.data) {
    const bytes = Math.ceil((String(file.data).length * 3) / 4);
    if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 50 Mo). Pour une vidéo plus lourde, utilisez un lien (YouTube/Vimeo)." }, { status: 413 });
  }
  const url = body?.url ? String(body.url).trim() : null;
  const kind = body?.kind === "video" ? "video" : body?.kind === "link" ? "link" : file?.data ? (String(file.mime || "").startsWith("video/") ? "video" : "pdf") : url ? "link" : "pdf";

  const roles = Array.isArray(body?.roles) ? body.roles.map((r: unknown) => String(r)).filter(Boolean).slice(0, 20) : [];
  const data = {
    title,
    description: body?.description?.trim() || null,
    category: body?.category?.trim() || null,
    kind,
    roles,
    fileName: file?.name ? String(file.name).slice(0, 200) : null,
    mime: file?.mime ? String(file.mime) : null,
    size: file?.size ? Number(file.size) : null,
    data: file?.data ? String(file.data) : null,
    url,
    createdById: session.user.id ?? null,
  };

  try {
    const p = await prisma.procedure.create({ data, select: { id: true } });
    return NextResponse.json({ ok: true, id: p.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
