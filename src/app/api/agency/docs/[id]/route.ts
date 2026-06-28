import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAnyDoc, removeAnyDoc } from "@/lib/client-docs";

// GET — télécharge un document de l'espace client (réservé à l'agence).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const doc = await getAnyDoc(id);
  if (!doc) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  return new NextResponse(Buffer.from(doc.data, "base64"), {
    status: 200,
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  await removeAnyDoc(id);
  return NextResponse.json({ ok: true });
}
