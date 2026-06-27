import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;
const MAX_BYTES = 100 * 1024 * 1024; // 100 Mo max pour un fichier hébergé
const KEEP_DAYS = 30;

function baseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://collab.lotier-immobilier.com").replace(/\/$/, "");
}

// POST /api/mail/upload — héberge un fichier volumineux pour l'envoyer en lien.
// body: { fileName, mime, size, data (base64) } → { url, fileName, size, expiresAt }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data = String(body?.data ?? "");
  const fileName = String(body?.fileName ?? "fichier").slice(0, 200);
  if (!data) return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
  const bytes = Math.ceil((data.length * 3) / 4);
  if (bytes > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 100 Mo)." }, { status: 413 });

  const token = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + KEEP_DAYS * 86400_000);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.mailUpload.create as any)({
      data: {
        token, fileName, mime: body?.mime ? String(body.mime) : null,
        size: body?.size ? Number(body.size) : bytes, data, ownerId: session.user.id, expiresAt,
      },
      select: { id: true },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  return NextResponse.json({
    url: `${baseUrl()}/api/public/file/${token}`,
    fileName, size: body?.size ? Number(body.size) : bytes,
    expiresAt: expiresAt.toISOString(), keepDays: KEEP_DAYS,
  });
}
