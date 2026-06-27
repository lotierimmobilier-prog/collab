import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection } from "@/lib/direction";

// GET /api/direction/employee-docs/[id]/file — téléchargement d'un document du
// dossier salarié (direction uniquement).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirection(session.user.roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = await (prisma.employeeDocument.findUnique as any)({
    where: { id }, select: { fileName: true, mime: true, data: true },
  }).catch(() => null);
  if (!doc?.data) return NextResponse.json({ error: "Document introuvable" }, { status: 404 });

  const buf = Buffer.from(String(doc.data), "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName || "document")}"`,
    },
  });
}
