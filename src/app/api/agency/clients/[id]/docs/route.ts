import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listTenantDocs, addAgencyDoc, AGENCY_CATEGORY_IDS, MAX_DOC_BYTES } from "@/lib/client-docs";

// GET — documents d'un locataire (déposés par l'agence + ses justificatifs).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ documents: await listTenantDocs(id) });
}

// POST — l'agence dépose un document pour le locataire (bail, EDL, quittance…).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const b = await req.json().catch(() => ({}));
  const category = AGENCY_CATEGORY_IDS.includes(b?.category) ? b.category : "autre";
  const fileName = typeof b?.fileName === "string" ? b.fileName.trim() : "";
  const data = typeof b?.data === "string" ? b.data : "";
  const mime = typeof b?.mime === "string" ? b.mime : "application/octet-stream";
  if (!fileName || !data) return NextResponse.json({ error: "Fichier requis." }, { status: 400 });
  const size = Math.ceil((data.length * 3) / 4);
  if (size > MAX_DOC_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)." }, { status: 413 });

  const { id: docId } = await addAgencyDoc(id, category, fileName, mime, size, data);
  return NextResponse.json({ ok: true, id: docId }, { status: 201 });
}
