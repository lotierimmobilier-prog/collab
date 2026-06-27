import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function own(userId: string, id: string) {
  const item = await prisma.driveItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return null;
  return item;
}

// GET /api/me/drive/[id]?download=1 — télécharge un fichier.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const item = await own(session.user.id, id);
  if (!item || item.kind !== "file" || !item.data) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const buf = Buffer.from(item.data, "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": item.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(item.name)}"`,
    },
  });
}

// PATCH /api/me/drive/[id] — renomme ({name}) ou déplace ({parentId}).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;
  const { id } = await params;
  const item = await own(uid, id);
  if (!item) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (!n) return NextResponse.json({ error: "Nom requis." }, { status: 400 });
    data.name = n;
  }
  if (body.parentId !== undefined) {
    let pid: string | null = body.parentId || null;
    if (pid === id) return NextResponse.json({ error: "Déplacement invalide." }, { status: 400 });
    if (pid) {
      const parent = await prisma.driveItem.findUnique({ where: { id: pid }, select: { userId: true, kind: true } });
      if (!parent || parent.userId !== uid || parent.kind !== "folder") pid = null;
    }
    data.parentId = pid;
  }
  await prisma.driveItem.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/me/drive/[id] — supprime (dossier = suppression récursive).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;
  const { id } = await params;
  const item = await own(uid, id);
  if (!item) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Suppression récursive d'un dossier : on parcourt l'arborescence.
  const toDelete: string[] = [id];
  if (item.kind === "folder") {
    let frontier = [id];
    let guard = 0;
    while (frontier.length && guard++ < 100) {
      const children = await prisma.driveItem.findMany({ where: { userId: uid, parentId: { in: frontier } }, select: { id: true } });
      const ids = children.map(c => c.id);
      toDelete.push(...ids);
      frontier = ids;
    }
  }
  await prisma.driveItem.deleteMany({ where: { userId: uid, id: { in: toDelete } } });
  return NextResponse.json({ ok: true, deleted: toDelete.length });
}
