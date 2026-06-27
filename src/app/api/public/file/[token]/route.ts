import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/public/file/[token] — téléchargement public d'un fichier volumineux
// joint à un email (lien envoyé au destinataire). Aucune authentification.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const up: any = await (prisma.mailUpload.findUnique as any)({ where: { token } }).catch(() => null);
  if (!up) return new NextResponse("Fichier introuvable ou lien expiré.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  if (up.expiresAt && new Date(up.expiresAt).getTime() < Date.now()) {
    return new NextResponse("Ce lien de téléchargement a expiré.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.mailUpload.update as any)({ where: { token }, data: { downloads: { increment: 1 } } }).catch(() => {});

  const buf = Buffer.from(String(up.data), "base64");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": up.mime || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(up.fileName || "fichier")}"`,
      "Content-Length": String(buf.length),
    },
  });
}
