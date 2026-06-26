import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function nextRef(): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await prisma.serviceOrder.count({ where: { ref: { startsWith: `ODS-${year}-` } } });
  return `ODS-${year}-${String(count + 1).padStart(3, "0")}`;
}

function fmt(o: Awaited<ReturnType<typeof prisma.serviceOrder.findFirst>>) {
  if (!o) return null;
  return {
    ...o,
    deadline:  o.deadline?.toISOString() ?? null,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");

  const orders = await prisma.serviceOrder.findMany({
    where: taskId ? { taskId } : {},
    include: { supplier: { select: { id: true, name: true, type: true, phone: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(orders.map(o => ({
    ...fmt(o),
    supplier: o.supplier,
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const {
    taskId, supplierId, title, description, address, deadline, amount, notes,
    interventionType, onSiteName, onSitePhone, onSiteRole, keyAtAgency, accessInfo,
    urgency, quoteRequired, agentName, agentPhone, attachments,
  } = body;
  if (!supplierId || !title?.trim()) return NextResponse.json({ error: "Fournisseur et titre requis" }, { status: 400 });

  // Pièces jointes (photos…) : [{id,name,mime,size,data}], plafonné.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const atts = Array.isArray(attachments)
    ? (attachments as any[]).filter(a => a && a.data && a.name).slice(0, 20).map(a => ({
        id: String(a.id ?? Math.random().toString(36).slice(2)),
        name: String(a.name).slice(0, 200),
        mime: String(a.mime ?? "application/octet-stream"),
        size: Number(a.size) || 0,
        data: String(a.data),
      }))
    : [];

  const ref   = await nextRef();
  const order = await prisma.serviceOrder.create({
    data: {
      ref,
      taskId:      taskId || null,
      supplierId,
      title:       title.trim(),
      description: description || null,
      address:     address || null,
      deadline:    deadline ? new Date(deadline) : null,
      amount:      amount ? parseFloat(amount) : null,
      notes:       notes || null,
      status:      "brouillon",
      createdBy:   session.user.id,
      interventionType: interventionType || null,
      onSiteName:  onSiteName || null,
      onSitePhone: onSitePhone || null,
      onSiteRole:  onSiteRole || null,
      keyAtAgency: !!keyAtAgency,
      accessInfo:  accessInfo || null,
      urgency:     urgency || null,
      quoteRequired: !!quoteRequired,
      agentName:   agentName || null,
      agentPhone:  agentPhone || null,
      attachments: atts.length ? atts : undefined,
      supplierToken: Math.random().toString(36).slice(2) + Date.now().toString(36),
    },
    include: { supplier: { select: { id: true, name: true, type: true, phone: true, email: true } } },
  });

  return NextResponse.json({ ...fmt(order), supplier: order.supplier }, { status: 201 });
}
