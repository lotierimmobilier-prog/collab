import { NextRequest, NextResponse } from "next/server";
import { getClientFromCookie } from "@/lib/client-auth";
import { listTenantDocs, addTenantUpload, UPLOAD_CATEGORY_IDS, MAX_DOC_BYTES } from "@/lib/client-docs";

// GET — liste des documents du locataire (fournis par l'agence + ses dépôts).
export async function GET() {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ documents: await listTenantDocs(client.id) });
}

// POST — le locataire dépose un justificatif. body: { category, fileName, mime, size, data(base64) }
export async function POST(req: NextRequest) {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const category = UPLOAD_CATEGORY_IDS.includes(b?.category) ? b.category : "autre";
  const fileName = typeof b?.fileName === "string" ? b.fileName.trim() : "";
  const data = typeof b?.data === "string" ? b.data : "";
  const mime = typeof b?.mime === "string" ? b.mime : "application/octet-stream";
  if (!fileName || !data) return NextResponse.json({ error: "Fichier requis." }, { status: 400 });

  const size = Math.ceil((data.length * 3) / 4); // taille approx. depuis le base64
  if (size > MAX_DOC_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 10 Mo)." }, { status: 413 });

  const { id } = await addTenantUpload(client.id, category, fileName, mime, size, data);
  return NextResponse.json({ ok: true, id }, { status: 201 });
}
