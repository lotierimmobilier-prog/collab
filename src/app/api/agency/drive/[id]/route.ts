import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";
import { AGENCY_UID } from "@/lib/rh-automation";

async function guardAndGet(id: string) {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isDirection(session.user.roleId)) return { error: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const item: any = await (prisma.driveItem.findUnique as any)({ where: { id } }).catch(() => null);
  if (!item || item.userId !== AGENCY_UID) return { error: NextResponse.json({ error: "Introuvable" }, { status: 404 }) };
  return { item };
}

// GET /api/agency/drive/[id] — télécharge un fichier du drive d'agence.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardAndGet(id);
  if (g.error) return g.error;
  const item = g.item;
  if (item.kind !== "file" || !item.data) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const buf = Buffer.from(String(item.data), "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": item.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(item.name)}"`,
    },
  });
}

// PATCH /api/agency/drive/[id] — renomme ({name}) ou déplace ({parentId}).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardAndGet(id);
  if (g.error) return g.error;

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parent: any = await (prisma.driveItem.findUnique as any)({ where: { id: pid }, select: { userId: true, kind: true } });
      if (!parent || parent.userId !== AGENCY_UID || parent.kind !== "folder") pid = null;
    }
    data.parentId = pid;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.driveItem.update as any)({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/agency/drive/[id] — supprime (dossier = suppression récursive).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guardAndGet(id);
  if (g.error) return g.error;
  const item = g.item;

  const toDelete: string[] = [id];
  if (item.kind === "folder") {
    let frontier = [id]; let guard = 0;
    while (frontier.length && guard++ < 100) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const children: any[] = await (prisma.driveItem.findMany as any)({ where: { userId: AGENCY_UID, parentId: { in: frontier } }, select: { id: true } });
      const ids = children.map(c => c.id);
      toDelete.push(...ids);
      frontier = ids;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.driveItem.deleteMany as any)({ where: { userId: AGENCY_UID, id: { in: toDelete } } });
  return NextResponse.json({ ok: true, deleted: toDelete.length });
}
