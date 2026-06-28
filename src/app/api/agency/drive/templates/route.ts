import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperSession, VISIBILITY, DEFAULT_FOLDERS } from "@/lib/drive-governance";

// Dossiers communs (poussés sur tous les drives) — gérés par le super admin.

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuperSession(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });
  const templates = await prisma.driveFolderTemplate.findMany({ orderBy: { order: "asc" } }).catch(() => []);
  // Parents possibles pour un sous-dossier imposé : dossiers par défaut + modèles.
  const defaults = DEFAULT_FOLDERS.map(d => ({ key: `default:${d.key}`, name: d.name }));
  return NextResponse.json({ templates, defaults });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuperSession(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = String(b?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  const visibility = VISIBILITY.includes(b?.visibility) ? b.visibility : "confidentiel";
  const parentKey = b?.parentKey ? String(b.parentKey) : null;
  const count = await prisma.driveFolderTemplate.count().catch(() => 0);
  const t = await prisma.driveFolderTemplate.create({
    data: { name, visibility, readonly: !!b?.readonly, order: count, parentKey },
  });
  return NextResponse.json({ ok: true, template: t }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuperSession(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const id = String(b?.id ?? "");
  if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (b.name !== undefined) data.name = String(b.name).trim();
  if (b.visibility !== undefined && VISIBILITY.includes(b.visibility)) data.visibility = b.visibility;
  if (b.readonly !== undefined) data.readonly = !!b.readonly;
  // parentKey : éviter de se rattacher à soi-même.
  if (b.parentKey !== undefined) data.parentKey = b.parentKey && b.parentKey !== `tpl:${id}` ? String(b.parentKey) : null;
  await prisma.driveFolderTemplate.update({ where: { id }, data }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuperSession(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const id = String(b?.id ?? "");
  if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });

  // Modèles à supprimer : celui demandé + ses sous-dossiers imposés (récursif).
  const all = await prisma.driveFolderTemplate.findMany({ select: { id: true, parentKey: true } }).catch(() => [] as { id: string; parentKey: string | null }[]);
  const toDelete = new Set<string>([id]);
  let grew = true; let guard = 0;
  while (grew && guard++ < 12) {
    grew = false;
    for (const t of all) {
      if (t.parentKey && toDelete.has(t.parentKey.replace(/^tpl:/, "")) && !toDelete.has(t.id)) { toDelete.add(t.id); grew = true; }
    }
  }
  const keys = [...toDelete].map(tid => `tpl:${tid}`);
  // Retire les dossiers imposés correspondants de tous les drives (avec contenu).
  const folders = await prisma.driveItem.findMany({ where: { templateKey: { in: keys } }, select: { id: true } }).catch(() => []);
  if (folders.length) {
    const fids = folders.map((f: { id: string }) => f.id);
    await prisma.driveItem.deleteMany({ where: { parentId: { in: fids } } }).catch(() => {});
    await prisma.driveItem.deleteMany({ where: { id: { in: fids } } }).catch(() => {});
  }
  await prisma.driveFolderTemplate.deleteMany({ where: { id: { in: [...toDelete] } } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
