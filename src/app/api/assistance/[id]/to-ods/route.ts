import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyTenantRequestStatus } from "@/lib/tenant-request-notify";

const ALLOWED = ["admin", "dirigeant", "direction", "gestionnaire", "syndic"];

async function nextRef(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.serviceOrder.count({ where: { ref: { startsWith: `ODS-${year}-` } } });
  return `ODS-${year}-${String(count + 1).padStart(3, "0")}`;
}

// POST /api/assistance/[id]/to-ods — crée un ordre de service (brouillon) à
// partir de la demande d'assistance (reprend adresse, description, contact,
// photos). body: { supplierId, interventionType?, urgency?, quoteRequired? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? "")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supplierId = body?.supplierId;
  if (!supplierId) return NextResponse.json({ error: "Sélectionnez un fournisseur." }, { status: 400 });

  const r = await prisma.assistanceRequest.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { prenom: true, nom: true } });
  const ref = await nextRef();

  const order = await prisma.serviceOrder.create({
    data: {
      ref,
      supplierId,
      title: body?.interventionType?.trim() || "Intervention",
      interventionType: body?.interventionType?.trim() || null,
      description: r.description || null,
      address: r.address || null,
      onSiteName: r.contactName || null,
      onSitePhone: r.contactPhone || null,
      onSiteRole: r.role || null,
      urgency: body?.urgency || null,
      quoteRequired: !!body?.quoteRequired,
      agentName: `${me?.prenom ?? ""} ${me?.nom ?? ""}`.trim() || null,
      attachments: r.photos ?? undefined,
      status: "brouillon",
      createdBy: session.user.id,
    },
    include: { supplier: { select: { id: true, name: true, email: true } } },
  });

  await prisma.assistanceRequest.update({ where: { id }, data: { status: "ods_cree", odsId: order.id } });
  // Le locataire est informé que sa demande passe « en cours de traitement ».
  after(() => notifyTenantRequestStatus(id));

  return NextResponse.json({ ok: true, odsId: order.id, ref: order.ref, supplierEmail: order.supplier?.email ?? null });
}
