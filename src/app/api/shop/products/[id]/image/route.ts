import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

export const maxDuration = 30;

const OK_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// GET /api/shop/products/[id]/image — sert la photo uploadée (binaire).
// Accessible à tout utilisateur connecté (affichage du catalogue).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await ctx.params;

  const p = await prisma.shopProduct.findUnique({
    where: { id },
    select: { imageData: true, imageMime: true },
  }).catch(() => null);
  if (!p?.imageData) return NextResponse.json({ error: "Aucune photo" }, { status: 404 });

  const buf = Buffer.from(p.imageData, "base64");
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": p.imageMime && OK_MIME.includes(p.imageMime) ? p.imageMime : "image/jpeg",
      // Re-validation : la direction peut remplacer la photo à tout moment.
      "Cache-Control": "no-cache, must-revalidate",
    },
  });
}

// POST /api/shop/products/[id]/image — téléverse/remplace la photo (direction).
// body: { content(base64, sans préfixe data:), mime }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  let body: { content?: string; mime?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  // On accepte aussi une data-URI complète (data:image/png;base64,XXXX).
  let b64 = String(body.content || "");
  let mime = String(body.mime || "");
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(b64);
  if (m) { mime = mime || m[1]; b64 = m[2]; }
  b64 = b64.trim();
  if (!b64) return NextResponse.json({ error: "Photo manquante." }, { status: 400 });
  if (!OK_MIME.includes(mime)) mime = "image/jpeg";
  // ~4 Mo d'image max (base64 ≈ 1.37× la taille binaire).
  if (b64.length > 4 * 1024 * 1024 * 1.4) return NextResponse.json({ error: "Photo trop volumineuse (max ~4 Mo)." }, { status: 413 });

  const exists = await prisma.shopProduct.findUnique({ where: { id }, select: { id: true } }).catch(() => null);
  if (!exists) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });

  await prisma.shopProduct.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { imageData: b64, imageMime: mime, image: `/api/shop/products/${id}/image` } as any,
  }).catch(() => {});
  return NextResponse.json({ ok: true, image: `/api/shop/products/${id}/image` });
}

// DELETE /api/shop/products/[id]/image — retire la photo uploadée (direction).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  await prisma.shopProduct.update({
    where: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { imageData: null, imageMime: null, image: null } as any,
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
