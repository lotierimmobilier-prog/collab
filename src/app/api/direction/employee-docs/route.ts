import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";

export const maxDuration = 60;
const MAX_BYTES = 20 * 1024 * 1024;
const CATEGORIES = ["contrat", "suivi_annuel", "medecine_travail", "mutuelle", "autre"];

async function guard() {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isDirection(session.user.roleId)) return { error: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  return { session };
}

// GET /api/direction/employee-docs?userId=… — documents du dossier d'un salarié.
export async function GET(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 });
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await (prisma.employeeDocument.findMany as any)({
      where: { userId },
      select: { id: true, category: true, label: true, issuer: true, number: true, issuedAt: true, expiresAt: true, fileName: true, mime: true, size: true, note: true, updatedAt: true },
      orderBy: [{ category: "asc" }, { issuedAt: "desc" }],
    });
    return NextResponse.json({
      items: rows.map(d => ({
        ...d,
        issuedAt: d.issuedAt ? new Date(d.issuedAt).toISOString() : null,
        expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
        updatedAt: new Date(d.updatedAt).toISOString(),
        hasFile: !!d.fileName,
      })),
    });
  } catch {
    return NextResponse.json({ items: [] }); // table pas encore migrée
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildData(body: any) {
  const file = body?.file;
  const cat = String(body?.category ?? "").trim();
  return {
    category: CATEGORIES.includes(cat) ? cat : "autre",
    label: body?.label?.trim() || null,
    issuer: body?.issuer?.trim() || null,
    number: body?.number?.trim() || null,
    issuedAt: body?.issuedAt ? new Date(body.issuedAt) : null,
    expiresAt: body?.expiresAt ? new Date(body.expiresAt) : null,
    note: body?.note?.trim() || null,
    ...(file?.data && {
      fileName: file?.name ? String(file.name).slice(0, 200) : null,
      mime: file?.mime ? String(file.mime) : null,
      size: file?.size ? Number(file.size) : null,
      data: String(file.data),
    }),
  };
}

// POST /api/direction/employee-docs — ajoute un document au dossier d'un salarié.
export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const userId = String(body?.userId ?? "").trim();
  if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 });
  if (body?.file?.data) {
    const bytes = Math.ceil((String(body.file.data).length * 3) / 4);
    if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = await (prisma.employeeDocument.create as any)({
      data: { userId, createdById: g.session!.user!.id, ...buildData(body) },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: doc.id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// PATCH /api/direction/employee-docs — modifie un document (id requis).
export async function PATCH(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  if (body?.file?.data) {
    const bytes = Math.ceil((String(body.file.data).length * 3) / 4);
    if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.employeeDocument.update as any)({ where: { id }, data: buildData(body) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE /api/direction/employee-docs?id=… — supprime un document.
export async function DELETE(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.employeeDocument.delete as any)({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
