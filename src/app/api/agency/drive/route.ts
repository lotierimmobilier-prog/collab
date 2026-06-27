import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";
import { AGENCY_UID } from "@/lib/rh-automation";

export const maxDuration = 60;
const MAX_BYTES = 20 * 1024 * 1024;

// Drive partagé de l'agence : tous les éléments appartiennent à AGENCY_UID.
// Réservé à la direction (lecture + écriture). C'est aussi là que sont rangés
// automatiquement les décomptes d'heures signés.

// Fil d'Ariane (racine → … → dossier courant) au sein du drive d'agence.
async function breadcrumb(folderId: string | null) {
  const path: { id: string; name: string }[] = [];
  let cur = folderId; let guard = 0;
  while (cur && guard++ < 40) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node: any = await (prisma.driveItem.findUnique as any)({ where: { id: cur }, select: { id: true, name: true, parentId: true, userId: true, kind: true } });
    if (!node || node.userId !== AGENCY_UID || node.kind !== "folder") break;
    path.unshift({ id: node.id, name: node.name });
    cur = node.parentId;
  }
  return path;
}

async function guard() {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isDirection(session.user.roleId)) return { error: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  return { session };
}

// GET /api/agency/drive?parentId=... — contenu d'un dossier (sans le binaire).
export async function GET(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const parentId = new URL(req.url).searchParams.get("parentId") || null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = await (prisma.driveItem.findMany as any)({
      where: { userId: AGENCY_UID, parentId },
      select: { id: true, parentId: true, kind: true, name: true, mime: true, size: true, createdAt: true, updatedAt: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });
    const path = await breadcrumb(parentId);
    return NextResponse.json({
      parentId, path,
      items: items.map(i => ({ ...i, createdAt: new Date(i.createdAt).toISOString(), updatedAt: new Date(i.updatedAt).toISOString() })),
    });
  } catch {
    return NextResponse.json({ parentId, path: [], items: [] });
  }
}

// POST /api/agency/drive — crée un dossier ou téléverse un fichier.
export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind === "folder" ? "folder" : "file";
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  let parentId: string | null = body?.parentId || null;

  if (parentId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parent: any = await (prisma.driveItem.findUnique as any)({ where: { id: parentId }, select: { userId: true, kind: true } });
    if (!parent || parent.userId !== AGENCY_UID || parent.kind !== "folder") parentId = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { userId: AGENCY_UID, parentId, kind, name };
  if (kind === "file") {
    if (!body?.data) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    const bytes = Math.ceil((String(body.data).length * 3) / 4);
    if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });
    data.mime = body.mime ? String(body.mime) : null;
    data.size = body.size ? Number(body.size) : bytes;
    data.data = String(body.data);
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = await (prisma.driveItem.create as any)({ data, select: { id: true } });
    return NextResponse.json({ ok: true, id: item.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
