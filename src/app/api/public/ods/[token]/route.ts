import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

const ROLE_LABEL: Record<string, string> = {
  locataire: "Locataire", coproprietaire: "Copropriétaire",
  proprietaire: "Propriétaire", gardien: "Gardien", autre: "Contact",
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const arr = (v: any) => (Array.isArray(v) ? v : []);
const meta = (f: { id?: string; kind?: string; name?: string; mime?: string; size?: number; at?: string; by?: string }) =>
  ({ id: f.id, kind: f.kind, name: f.name, mime: f.mime, size: f.size, at: f.at, by: f.by });

// GET /api/public/ods/[token]            → détail + échanges
// GET /api/public/ods/[token]?download=<id> → télécharge une pièce
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ods = await prisma.serviceOrder.findUnique({
    where: { supplierToken: token },
    include: { supplier: { select: { name: true } } },
  }).catch(() => null);
  if (!ods) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });

  const dl = req.nextUrl.searchParams.get("download");
  if (dl) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = [...arr(ods.attachments), ...arr(ods.supplierFiles)] as any[];
    const f = all.find(x => x?.id === dl);
    if (!f?.data) return NextResponse.json({ error: "Pièce introuvable" }, { status: 404 });
    return new NextResponse(Buffer.from(String(f.data), "base64"), {
      headers: {
        "Content-Type": f.mime || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(f.name || "fichier")}"`,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    ref: ods.ref,
    supplier: ods.supplier?.name,
    interventionType: ods.interventionType,
    title: ods.title,
    description: ods.description,
    address: ods.address,
    onSite: (ods.onSiteName || ods.onSitePhone) ? {
      name: ods.onSiteName, phone: ods.onSitePhone,
      role: ods.onSiteRole ? (ROLE_LABEL[ods.onSiteRole] ?? ods.onSiteRole) : null,
    } : null,
    keyAtAgency: ods.keyAtAgency,
    accessInfo: ods.accessInfo,
    urgency: ods.urgency,
    deadline: ods.deadline?.toISOString() ?? null,
    quoteRequired: ods.quoteRequired,
    status: ods.status,
    agence: "Lotier Immobilier",
    photos: arr(ods.attachments).map(meta),        // photos envoyées par l'agence
    files: arr(ods.supplierFiles).map(meta),       // dépôts du fournisseur
    messages: arr(ods.messages),
  });
}

// POST /api/public/ods/[token] — actions du fournisseur.
//   { action:"message", body, name? }
//   { action:"files", kind, files:[{name,mime,size,data}] }
//   { action:"status", status }
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ods = await prisma.serviceOrder.findUnique({
    where: { supplierToken: token },
    select: { id: true, messages: true, supplierFiles: true, supplier: { select: { name: true } } },
  }).catch(() => null);
  if (!ods) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const who = (body?.name && String(body.name).trim()) || ods.supplier?.name || "Fournisseur";
  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};

  if (action === "message") {
    const text = String(body?.body ?? "").trim().slice(0, 4000);
    if (!text) return NextResponse.json({ error: "Message vide." }, { status: 400 });
    data.messages = [...arr(ods.messages), { id: rid(), author: "fournisseur", name: who, body: text, at: now }];
  } else if (action === "files") {
    const kind = ["devis", "facture", "photo", "autre"].includes(body?.kind) ? body.kind : "autre";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const files = arr(body?.files).filter((f: any) => f?.data && f?.name).slice(0, 12).map((f: any) => ({
      id: rid(), kind, name: String(f.name).slice(0, 200), mime: String(f.mime || "application/octet-stream"),
      size: Number(f.size) || 0, data: String(f.data), at: now, by: who,
    }));
    if (!files.length) return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });
    data.supplierFiles = [...arr(ods.supplierFiles), ...files];
  } else if (action === "status") {
    const allowed = ["accepté", "en_cours", "terminé", "annulé"];
    if (!allowed.includes(body?.status)) return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
    data.status = body.status;
    data.messages = [...arr(ods.messages), { id: rid(), author: "fournisseur", name: who, body: `A mis le statut à « ${body.status} ».`, at: now }];
  } else {
    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }

  try {
    await prisma.serviceOrder.update({ where: { id: ods.id }, data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

function rid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
