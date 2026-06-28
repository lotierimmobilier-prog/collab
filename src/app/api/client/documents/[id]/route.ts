import { NextRequest, NextResponse } from "next/server";
import { getClientFromCookie } from "@/lib/client-auth";
import { getTenantDoc, removeTenantUpload } from "@/lib/client-docs";

// GET — télécharge un document du locataire (vérifie l'appartenance).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const doc = await getTenantDoc(client.id, id);
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  const buf = Buffer.from(doc.data, "base64");
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

// DELETE — supprime un justificatif déposé par le locataire.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await removeTenantUpload(client.id, id);
  return NextResponse.json({ ok: true });
}
