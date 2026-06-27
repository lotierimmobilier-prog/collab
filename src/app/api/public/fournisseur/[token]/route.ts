import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confStatus } from "@/lib/supplier-conformite";

const MAX_BYTES = 20 * 1024 * 1024;

async function bySupplierToken(token: string) {
  if (!token) return null;
  return prisma.supplier.findUnique({ where: { portalToken: token } });
}

// GET /api/public/fournisseur/[token] — état des justificatifs (espace fournisseur).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await bySupplierToken(token).catch(() => null);
  if (!s) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sa = s as any;
  return NextResponse.json({
    name: s.name,
    insurance: { expiry: sa.insuranceExpiry ? new Date(sa.insuranceExpiry).toISOString() : null, has: !!sa.insuranceDoc, status: confStatus(sa.insuranceExpiry) },
    urssaf: { expiry: sa.urssafExpiry ? new Date(sa.urssafExpiry).toISOString() : null, has: !!sa.urssafDoc, status: confStatus(sa.urssafExpiry) },
  });
}

// POST /api/public/fournisseur/[token] — dépôt d'un justificatif.
//   { kind:"insurance"|"urssaf", expiry?, file:{name,mime,size,data} }
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = await bySupplierToken(token).catch(() => null);
  if (!s) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind === "urssaf" ? "urssaf" : "insurance";
  const file = body?.file;
  if (!file?.data) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  const bytes = Math.ceil((String(file.data).length * 3) / 4);
  if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)." }, { status: 413 });

  const doc = {
    name: String(file.name || "attestation").slice(0, 200),
    mime: file.mime ? String(file.mime) : null,
    size: file.size ? Number(file.size) : bytes,
    data: String(file.data),
  };
  const expiry = body?.expiry ? new Date(body.expiry) : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = kind === "urssaf"
    ? { urssafDoc: doc, ...(expiry && { urssafExpiry: expiry }) }
    : { insuranceDoc: doc, ...(expiry && { insuranceExpiry: expiry }) };

  await prisma.supplier.update({ where: { id: s.id }, data });
  return NextResponse.json({ ok: true });
}
