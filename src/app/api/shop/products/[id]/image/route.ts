import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

export const maxDuration = 30;
export const runtime = "nodejs";

const OK_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// On passe par du SQL brut plutôt que le client Prisma pour rester robuste si
// le client déployé est en retard sur le schéma (colonnes imageData/imageMime).
async function ensureColumns() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "imageData" TEXT`).catch(() => {});
  await prisma.$executeRawUnsafe(`ALTER TABLE "shop_products" ADD COLUMN IF NOT EXISTS "imageMime" TEXT`).catch(() => {});
}

// GET /api/shop/products/[id]/image — sert la photo uploadée (binaire).
// Accessible à tout utilisateur connecté (affichage du catalogue).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await ctx.params;

  const rows = await prisma.$queryRawUnsafe(
    `SELECT "imageData", "imageMime" FROM "shop_products" WHERE "id" = $1 LIMIT 1`, id,
  ).catch(() => []) as { imageData: string | null; imageMime: string | null }[];
  const row = rows?.[0];
  if (!row?.imageData) return NextResponse.json({ error: "Aucune photo" }, { status: 404 });

  const buf = Buffer.from(row.imageData, "base64");
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": row.imageMime && OK_MIME.includes(row.imageMime) ? row.imageMime : "image/jpeg",
      // Re-validation : la direction peut remplacer la photo à tout moment.
      "Cache-Control": "no-cache, must-revalidate",
    },
  });
}

// POST /api/shop/products/[id]/image — téléverse/remplace la photo (direction).
// body: { content(base64, avec ou sans préfixe data:), mime }
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

  try {
    await ensureColumns();
    const path = `/api/shop/products/${id}/image`;
    const n = await prisma.$executeRawUnsafe(
      `UPDATE "shop_products" SET "imageData" = $1, "imageMime" = $2, "image" = $3, "updatedAt" = now() WHERE "id" = $4`,
      b64, mime, path, id,
    );
    if (!n) return NextResponse.json({ error: "Article introuvable." }, { status: 404 });
    return NextResponse.json({ ok: true, image: path });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE /api/shop/products/[id]/image — retire la photo uploadée (direction).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });
  const { id } = await ctx.params;

  await ensureColumns();
  await prisma.$executeRawUnsafe(
    `UPDATE "shop_products" SET "imageData" = NULL, "imageMime" = NULL, "image" = NULL, "updatedAt" = now() WHERE "id" = $1`, id,
  ).catch(() => {});
  return NextResponse.json({ ok: true });
}
