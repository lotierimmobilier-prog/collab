import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/legal-documents/[id] — télécharge le fichier d'un document
// (ADMIN uniquement : l'admin voit/contrôle tous les documents).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.personalDocument.findUnique({ where: { id } });
  if (!doc || !doc.data) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const buf = Buffer.from(doc.data, "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName || "document")}"`,
    },
  });
}
