import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /mail-view/[token] — version en ligne d'un email envoyé (lien « voir la
// version en ligne »). Public : le destinataire n'a pas de compte. Le token est
// aléatoire (UUID) et non énumérable.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT html FROM mail_public_views WHERE token = $1 LIMIT 1`, token,
    );
    const html = rows?.[0]?.html;
    if (!html) {
      return new NextResponse(notFoundPage(), { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=600" } });
  } catch {
    return new NextResponse(notFoundPage(), { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

function notFoundPage(): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Message indisponible</title></head>
<body style="margin:0;font-family:Arial,sans-serif;background:#F3F1EC;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;color:#9b8e79;padding:24px;">
    <div style="font-family:Georgia,serif;font-size:22px;letter-spacing:3px;color:#1C1A17;">LOTIER<span style="color:#B8966A;"> IMMOBILIER</span></div>
    <p style="margin-top:16px;font-size:14px;">Ce message n'est plus disponible en ligne.</p>
  </div>
</body></html>`;
}
