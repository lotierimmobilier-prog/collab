import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 20 * 1024 * 1024;

// Vérifie que le document appartient bien à l'utilisateur courant.
async function ownDoc(userId: string, id: string) {
  const doc = await prisma.personalDocument.findUnique({ where: { id } });
  if (!doc || doc.userId !== userId) return null;
  return doc;
}

// GET /api/me/legal-documents/[id]?download=1 — télécharge le fichier.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const doc = await ownDoc(session.user.id, id);
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!doc.data) return NextResponse.json({ error: "Aucun fichier" }, { status: 404 });

  const buf = Buffer.from(doc.data, "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName || "document")}"`,
    },
  });
}

// PATCH /api/me/legal-documents/[id] — met à jour les champs / remplace le fichier.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const doc = await ownDoc(session.user.id, id);
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (body.label !== undefined) data.label = body.label?.trim() || null;
  if (body.number !== undefined) data.number = body.number?.trim() || null;
  if (body.issuer !== undefined) data.issuer = body.issuer?.trim() || null;
  if (body.issuedAt !== undefined) data.issuedAt = body.issuedAt ? new Date(body.issuedAt) : null;
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (body.alurHours !== undefined) data.alurHours = body.alurHours !== "" && body.alurHours != null ? parseInt(String(body.alurHours), 10) : null;
  if (body.file?.data) {
    const bytes = Math.ceil((String(body.file.data).length * 3) / 4);
    if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });
    data.fileName = String(body.file.name || "document").slice(0, 200);
    data.mime = body.file.mime ? String(body.file.mime) : null;
    data.size = body.file.size ? Number(body.file.size) : null;
    data.data = String(body.file.data);
    data.lastReminderAt = null; // nouveau justificatif → on réarme les rappels
  }

  await prisma.personalDocument.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

// DELETE /api/me/legal-documents/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const doc = await ownDoc(session.user.id, id);
  if (!doc) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  await prisma.personalDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
