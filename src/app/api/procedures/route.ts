import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
const MAX_BYTES = 50 * 1024 * 1024; // 50 Mo (vidéos courtes ; sinon utiliser un lien)

// GET /api/procedures — liste des procédures (visible par tous les connectés,
// sans le binaire ; juste un indicateur de présence de fichier).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const rows = await prisma.procedure.findMany({
      select: { id: true, title: true, description: true, category: true, kind: true, fileName: true, mime: true, size: true, url: true, createdAt: true, updatedAt: true },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });
    return NextResponse.json(rows.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      hasFile: !!p.fileName,
    })));
  } catch {
    return NextResponse.json([]); // table pas encore migrée
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

  const data = {
    title,
    description: body?.description?.trim() || null,
    category: body?.category?.trim() || null,
    kind,
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
