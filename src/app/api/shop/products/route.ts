import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

const CATEGORIES = ["textile", "accessoire", "bureau", "autre"];

// GET /api/shop/products — catalogue.
// Tout le monde voit les articles actifs ; la direction peut voir l'ensemble
// (y compris les articles désactivés) via ?all=1.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const isDir = isDirectionRole(session.user.roleId ?? "");
  const all = req.nextUrl.searchParams.get("all") === "1" && isDir;

  const products = await prisma.shopProduct.findMany({
    where: all ? {} : { active: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  }).catch(() => []);

  return NextResponse.json({ products, isDir });
}

// POST /api/shop/products — créer un article (direction).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isDirectionRole(session.user.roleId ?? "")) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  let body: { name?: string; description?: string; price?: number; category?: string; image?: string; order?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const name = (body.name || "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Nom trop court." }, { status: 400 });

  const created = await prisma.shopProduct.create({
    data: {
      name: name.slice(0, 120),
      description: (body.description || "").trim().slice(0, 1000) || null,
      price: Math.max(0, Math.round((Number(body.price) || 0) * 100) / 100),
      category: CATEGORIES.includes(body.category || "") ? body.category : "autre",
      image: (body.image || "").trim().slice(0, 500) || null,
      order: Number.isFinite(body.order) ? Number(body.order) : 0,
    },
  }).catch(() => null);
  if (!created) return NextResponse.json({ error: "Création impossible." }, { status: 500 });

  return NextResponse.json({ ok: true, id: created.id });
}
