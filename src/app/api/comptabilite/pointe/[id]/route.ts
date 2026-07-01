import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta } from "@/lib/comptabilite";

// GET — télécharge le PDF d'une pointe de trésorerie (direction uniquement).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canAccessCompta((session.user as { roleId?: string }).roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.$queryRawUnsafe(`SELECT "fileName", data FROM treso_pointe WHERE id = $1`, id).catch(() => []);
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const buf = Buffer.from(p.data, "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(p.fileName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
