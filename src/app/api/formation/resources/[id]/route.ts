import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getResourceFile, removeResource } from "@/lib/formation-resources";

// GET — téléchargement d'un support fichier (tout utilisateur connecté).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  const f = await getResourceFile(id);
  if (!f) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const buf = Buffer.from(f.data, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": f.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(f.fileName || "support")}"`,
    },
  });
}

// DELETE — suppression d'un support (admin).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const { id } = await params;
  await removeResource(id);
  return NextResponse.json({ ok: true });
}
