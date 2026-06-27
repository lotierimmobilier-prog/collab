import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 50 * 1024 * 1024;

// GET /api/procedures/[id] — télécharge / diffuse le fichier (tous connectés).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const p = await prisma.procedure.findUnique({ where: { id } });
  if (!p || !p.data) return NextResponse.json({ error: "Aucun fichier" }, { status: 404 });

  const buf = Buffer.from(p.data, "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": p.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(p.fileName || "procedure")}"`,
      "Accept-Ranges": "bytes",
    },
  });
}

// PATCH /api/procedures/[id] — modifier (ADMIN uniquement).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body.title !== undefined) { const t = String(body.title).trim(); if (!t) return NextResponse.json({ error: "Titre requis." }, { status: 400 }); data.title = t; }
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.category !== undefined) data.category = body.category?.trim() || null;
  if (body.url !== undefined) data.url = body.url ? String(body.url).trim() : null;
  if (body.file?.data) {
    const bytes = Math.ceil((String(body.file.data).length * 3) / 4);
    if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 50 Mo)." }, { status: 413 });
    data.fileName = String(body.file.name || "procedure").slice(0, 200);
    data.mime = body.file.mime ? String(body.file.mime) : null;
    data.size = body.file.size ? Number(body.file.size) : null;
    data.data = String(body.file.data);
    data.kind = String(body.file.mime || "").startsWith("video/") ? "video" : "pdf";
  } else if (body.url !== undefined && body.url) {
    if (!body.file?.data) data.kind = "link";
  }

  await prisma.procedure.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/procedures/[id] — supprimer (ADMIN uniquement).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  const { id } = await params;
  await prisma.procedure.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
