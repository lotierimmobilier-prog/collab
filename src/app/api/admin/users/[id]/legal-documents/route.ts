import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
const MAX_BYTES = 20 * 1024 * 1024;

// GET /api/admin/users/[id]/legal-documents — infos + documents d'un agent.
// ADMIN uniquement. Les documents sont les MÊMES enregistrements que ceux que
// l'agent voit dans « Mon espace » → toute saisie ici lui est visible, et
// inversement (table partagée : synchronisation automatique).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, prenom: true, nom: true, email: true, roleId: true, phone: true, active: true, createdAt: true, lastLogin: true },
  }).catch(() => null);
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  let docs: Array<Record<string, unknown>> = [];
  try {
    const rows = await prisma.personalDocument.findMany({
      where: { userId: id },
      select: { id: true, kind: true, label: true, number: true, issuer: true, issuedAt: true, expiresAt: true, alurHours: true, fileName: true, updatedAt: true },
      orderBy: { kind: "asc" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    docs = rows.map((d: any) => ({
      ...d,
      issuedAt: d.issuedAt?.toISOString() ?? null,
      expiresAt: d.expiresAt?.toISOString() ?? null,
      updatedAt: d.updatedAt.toISOString(),
      hasFile: !!d.fileName,
    }));
  } catch { docs = []; }

  return NextResponse.json({
    user: {
      ...user,
      createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lastLogin: (user as any).lastLogin ? new Date((user as any).lastLogin).toISOString() : null,
    },
    docs,
  });
}

// POST /api/admin/users/[id]/legal-documents — crée un document POUR cet agent.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const kind = String(body?.kind ?? "").trim();
  if (!kind) return NextResponse.json({ error: "Type de document requis." }, { status: 400 });

  const file = body?.file;
  if (file?.data) {
    const bytes = Math.ceil((String(file.data).length * 3) / 4);
    if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });
  }

  const data = {
    userId: id,
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
