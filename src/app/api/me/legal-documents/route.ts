import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
const MAX_BYTES = 20 * 1024 * 1024;

// GET /api/me/legal-documents — documents de l'utilisateur courant (sans le
// contenu du fichier ; cloisonné : chacun ne voit QUE ses documents).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  try {
    const docs = await prisma.personalDocument.findMany({
      where: { userId: session.user.id },
      select: {
        id: true, kind: true, label: true, number: true, issuer: true,
        issuedAt: true, expiresAt: true, alurHours: true,
        fileName: true, mime: true, size: true, createdAt: true, updatedAt: true,
      },
      orderBy: { kind: "asc" },
    });
    return NextResponse.json(docs.map(d => ({
      ...d,
      issuedAt: d.issuedAt?.toISOString() ?? null,
      expiresAt: d.expiresAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      hasFile: !!d.fileName,
    })));
  } catch {
    return NextResponse.json([]); // table pas encore migrée
  }
}

// POST /api/me/legal-documents — crée un document pour l'utilisateur courant.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = String(body?.kind ?? "").trim();
  if (!kind) return NextResponse.json({ error: "Type de document requis." }, { status: 400 });

  const file = body?.file;
  if (file?.data) {
    const bytes = Math.ceil((String(file.data).length * 3) / 4);
    if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });
  }

  const data = {
    userId: session.user.id,
    kind,
    label: body?.label?.trim() || null,
    number: body?.number?.trim() || null,
    issuer: body?.issuer?.trim() || null,
    issuedAt: body?.issuedAt ? new Date(body.issuedAt) : null,
    expiresAt: body?.expiresAt ? new Date(body.expiresAt) : null,
    alurHours: body?.alurHours != null && body.alurHours !== "" ? parseInt(String(body.alurHours), 10) : null,
    fileName: file?.name ? String(file.name).slice(0, 200) : null,
    mime: file?.mime ? String(file.mime) : null,
    size: file?.size ? Number(file.size) : null,
    data: file?.data ? String(file.data) : null,
  };

  try {
    const doc = await prisma.personalDocument.create({ data, select: { id: true } });
    return NextResponse.json({ ok: true, id: doc.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
