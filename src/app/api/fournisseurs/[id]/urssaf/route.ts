import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/fournisseurs/[id]/urssaf — télécharge l'attestation URSSAF.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const s = await prisma.supplier.findUnique({ where: { id }, select: { urssafDoc: true } });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = (s as any)?.urssafDoc;
  if (!doc?.data) return NextResponse.json({ error: "Aucune attestation" }, { status: 404 });

  const buf = Buffer.from(String(doc.data), "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name || "attestation-urssaf")}"`,
    },
  });
}
