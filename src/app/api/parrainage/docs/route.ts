import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listDocsFor } from "@/lib/parrainage";

export const maxDuration = 60;
const MAX_BYTES = 20 * 1024 * 1024; // 20 Mo par document

// GET — documents visibles par l'utilisateur (toute sa lignée de parrainage).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ docs: await listDocsFor(session.user.id) });
}

// POST — déposer un document (partagé avec toute la lignée).
// { fileName, mime, size, note?, data (base64) }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data = String(body?.data ?? "");
  const fileName = String(body?.fileName ?? "document").slice(0, 200);
  if (!data) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  const bytes = Math.ceil((data.length * 3) / 4);
  if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 413 });

  const id = randomUUID();
  try {
    // Filet de sécurité : garantit la présence de la table même si la
    // migration n'a pas encore été appliquée sur cet environnement.
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS parrainage_doc (
         id TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL, "fileName" TEXT NOT NULL,
         mime TEXT, size INTEGER, note TEXT, data TEXT NOT NULL,
         "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP )`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO parrainage_doc (id, "ownerId", "fileName", mime, size, note, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      id, session.user.id, fileName,
      body?.mime ? String(body.mime) : null,
      body?.size ? Number(body.size) : bytes,
      body?.note ? String(body.note).slice(0, 500) : null,
      data,
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}

// DELETE ?id= — suppression réservée au déposant (ou à l'admin).
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const isAdmin = (session.user as { roleId?: string }).roleId === "admin";
  try {
    if (isAdmin) await prisma.$executeRawUnsafe(`DELETE FROM parrainage_doc WHERE id = $1`, id);
    else await prisma.$executeRawUnsafe(`DELETE FROM parrainage_doc WHERE id = $1 AND "ownerId" = $2`, id, session.user.id);
  } catch { /* ignore */ }
  return NextResponse.json({ ok: true });
}
