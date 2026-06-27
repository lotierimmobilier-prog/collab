import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
const MAX_BYTES = 20 * 1024 * 1024;

// Construit le fil d'Ariane (racine → … → dossier courant), cloisonné.
async function breadcrumb(userId: string, folderId: string | null) {
  const path: { id: string; name: string }[] = [];
  let cur = folderId;
  let guard = 0;
  while (cur && guard++ < 40) {
    const node = await prisma.driveItem.findUnique({ where: { id: cur }, select: { id: true, name: true, parentId: true, userId: true, kind: true } });
    if (!node || node.userId !== userId || node.kind !== "folder") break;
    path.unshift({ id: node.id, name: node.name });
    cur = node.parentId;
  }
  return path;
}

// GET /api/me/drive?parentId=... — contenu d'un dossier (sans le binaire).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;
  const parentId = new URL(req.url).searchParams.get("parentId") || null;

  try {
    const items = await prisma.driveItem.findMany({
      where: { userId: uid, parentId },
      select: { id: true, parentId: true, kind: true, name: true, mime: true, size: true, createdAt: true, updatedAt: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }], // dossiers (folder) avant fichiers (file)
    });
    const path = await breadcrumb(uid, parentId);
    return NextResponse.json({
      parentId,
      path,
      items: items.map(i => ({ ...i, createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString() })),
    });
  } catch {
    return NextResponse.json({ parentId, path: [], items: [] });
  }
}

// POST /api/me/drive — crée un dossier ou téléverse un fichier.
//   { kind:"folder", name, parentId? } | { kind:"file", name, mime, size, data, parentId? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind === "folder" ? "folder" : "file";
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  let parentId: string | null = body?.parentId || null;

  // Le dossier parent doit appartenir à l'utilisateur.
  if (parentId) {
    const parent = await prisma.driveItem.findUnique({ where: { id: parentId }, select: { userId: true, kind: true } });
    if (!parent || parent.userId !== uid || parent.kind !== "folder") parentId = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { userId: uid, parentId, kind, name };
  if (kind === "file") {
    if (!body?.data) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    const bytes = Math.ceil((String(body.data).length * 3) / 4);
    if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });
    data.mime = body.mime ? String(body.mime) : null;
    data.size = body.size ? Number(body.size) : bytes;
    data.data = String(body.data);
  }

  try {
    const item = await prisma.driveItem.create({ data, select: { id: true } });
    return NextResponse.json({ ok: true, id: item.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
