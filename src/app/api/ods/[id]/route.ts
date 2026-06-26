import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arr = (v: any) => (Array.isArray(v) ? v : []);
const fileMeta = (f: { id?: string; kind?: string; name?: string; mime?: string; size?: number; at?: string; by?: string }) =>
  ({ id: f.id, kind: f.kind, name: f.name, mime: f.mime, size: f.size, at: f.at, by: f.by });

// GET /api/ods/[id]          → détail complet (échanges)
// GET /api/ods/[id]?download=<fileId> → télécharge une pièce
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const o = await prisma.serviceOrder.findUnique({
    where: { id }, include: { supplier: { select: { name: true, email: true } } },
  });
  if (!o) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const dl = req.nextUrl.searchParams.get("download");
  if (dl) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const f = [...arr(o.attachments), ...arr(o.supplierFiles)].find((x: any) => x?.id === dl);
    if (!f?.data) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return new NextResponse(Buffer.from(String(f.data), "base64"), {
      headers: { "Content-Type": f.mime || "application/octet-stream", "Content-Disposition": `inline; filename="${encodeURIComponent(f.name || "fichier")}"` },
    });
  }

  return NextResponse.json({
    id: o.id, ref: o.ref, status: o.status, supplier: o.supplier,
    supplierToken: o.supplierToken,
    photos: arr(o.attachments).map(fileMeta),
    files: arr(o.supplierFiles).map(fileMeta),
    messages: arr(o.messages),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const order = await prisma.serviceOrder.update({
    where: { id },
    data: {
      ...(body.status      !== undefined && { status: body.status }),
      ...(body.title       !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.address     !== undefined && { address: body.address || null }),
      ...(body.deadline    !== undefined && { deadline: body.deadline ? new Date(body.deadline) : null }),
      ...(body.amount      !== undefined && { amount: body.amount ? parseFloat(body.amount) : null }),
      ...(body.notes       !== undefined && { notes: body.notes || null }),
      ...(body.supplierId  !== undefined && { supplierId: body.supplierId }),
    },
    include: { supplier: { select: { id: true, name: true, type: true } } },
  });

  return NextResponse.json({
    ...order,
    deadline:  order.deadline?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await prisma.serviceOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
