import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperSession, VISIBILITY } from "@/lib/drive-governance";

// Dossiers communs (poussés sur tous les drives) — gérés par le super admin.

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuperSession(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });
  const templates = await prisma.driveFolderTemplate.findMany({ orderBy: { order: "asc" } }).catch(() => []);
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuperSession(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = String(b?.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  const visibility = VISIBILITY.includes(b?.visibility) ? b.visibility : "confidentiel";
  const count = await prisma.driveFolderTemplate.count().catch(() => 0);
  const t = await prisma.driveFolderTemplate.create({
    data: { name, visibility, readonly: !!b?.readonly, order: count },
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
  // Retire le dossier commun de tous les drives (avec son contenu).
  const folders = await prisma.driveItem.findMany({ where: { templateKey: `tpl:${id}` }, select: { id: true } }).catch(() => []);
  if (folders.length) {
    const fids = folders.map((f: { id: string }) => f.id);
    await prisma.driveItem.deleteMany({ where: { parentId: { in: fids } } }).catch(() => {});
    await prisma.driveItem.deleteMany({ where: { id: { in: fids } } }).catch(() => {});
  }
  await prisma.driveFolderTemplate.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
