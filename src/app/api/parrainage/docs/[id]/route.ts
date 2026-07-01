import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDocForUser } from "@/lib/parrainage";

// GET — télécharge un document si l'utilisateur est dans la lignée du déposant.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const doc = await getDocForUser(session.user.id, id);
  if (!doc) return NextResponse.json({ error: "Introuvable ou accès refusé" }, { status: 404 });

  const buf = Buffer.from(doc.data, "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
