import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureDriveFolders, roleCanSee, isSuperSession, getDriveFolderOrder } from "@/lib/drive-governance";

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
  const role = (session.user as { roleId?: string }).roleId ?? null;
  const parentId = new URL(req.url).searchParams.get("parentId") || null;

  // À la racine : on s'assure que les dossiers imposés + communs existent.
  if (!parentId) await ensureDriveFolders(uid);

  const sel = { id: true, parentId: true, kind: true, name: true, mime: true, size: true, system: true, readonly: true, visibility: true, templateKey: true, createdAt: true, updatedAt: true } as const;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const own: any[] = await prisma.driveItem.findMany({
      where: { userId: uid, parentId },
      select: sel,
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    });

    // Tri d'affichage : dossiers d'abord, dossiers imposés dans l'ordre choisi
    // par le super admin (pour tous), puis le reste alphabétiquement, fichiers ensuite.
    const order = await getDriveFolderOrder();
    const rank = (it: { templateKey?: string | null }) => {
      const i = it.templateKey ? order.indexOf(it.templateKey) : -1;
      return i === -1 ? 100000 : i;
    };
    own.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;     // dossiers avant fichiers
      if (a.kind === "folder") { const r = rank(a) - rank(b); if (r !== 0) return r; }
      return String(a.name).localeCompare(String(b.name), "fr");
    });

    // Contenu partagé : si le dossier ouvert est un dossier commun dont la
    // visibilité m'inclut, on agrège les FICHIERS déposés par les autres agents
    // dans le même dossier (lecture seule).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let shared: any[] = [];
    if (parentId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const folder: any = await prisma.driveItem.findUnique({ where: { id: parentId }, select: { userId: true, templateKey: true, visibility: true } }).catch(() => null);
      if (folder && folder.userId === uid && folder.templateKey && roleCanSee(folder.visibility, role)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const peers: any[] = await prisma.driveItem.findMany({
          where: { templateKey: folder.templateKey, userId: { not: uid }, kind: "folder" },
          select: { id: true, userId: true },
        }).catch(() => []);
        if (peers.length) {
          const owners = new Map(peers.map(p => [p.id, p.userId]));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const files: any[] = await prisma.driveItem.findMany({
            where: { parentId: { in: peers.map(p => p.id) }, kind: "file" },
            select: sel,
          }).catch(() => []);
          const userIds = [...new Set(peers.map(p => p.userId))];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const users: any[] = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, prenom: true, nom: true } }).catch(() => []);
          const nameById = new Map(users.map(u => [u.id, `${u.prenom} ${u.nom}`.trim()]));
          shared = files.map(f => ({ ...f, sharedFrom: nameById.get(owners.get(f.parentId)) ?? "Agence", readonly: true }));
        }
      }
    }

    const path = await breadcrumb(uid, parentId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fmt = (i: any) => ({ ...i, createdAt: i.createdAt.toISOString(), updatedAt: i.updatedAt.toISOString() });
    return NextResponse.json({
      parentId,
      path,
      canManageCommon: isSuperSession(session),
      items: own.map(fmt),
      shared: shared.map(fmt),
    });
  } catch {
    return NextResponse.json({ parentId, path: [], items: [], shared: [] });
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
    const parent = await prisma.driveItem.findUnique({ where: { id: parentId }, select: { userId: true, kind: true, readonly: true } });
    if (!parent || parent.userId !== uid || parent.kind !== "folder") parentId = null;
    // Dossier en lecture seule (ressources agence) : seul le super admin y dépose.
    else if (parent.readonly && !isSuperSession(session)) {
      return NextResponse.json({ error: "Ce dossier est en lecture seule." }, { status: 403 });
    }
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
