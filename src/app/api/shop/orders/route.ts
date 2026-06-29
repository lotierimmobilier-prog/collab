import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDirectionRole } from "@/lib/dashboard-prefs";

// GET /api/shop/orders — commandes.
// Par défaut : les commandes de l'utilisateur courant.
// La direction peut récupérer toutes les commandes via ?all=1.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = (session.user as { id?: string }).id ?? "";
  const isDir = isDirectionRole(session.user.roleId ?? "");
  const all = req.nextUrl.searchParams.get("all") === "1" && isDir;

  const orders = await prisma.shopOrder.findMany({
    where: all ? {} : { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  }).catch(() => []);

  return NextResponse.json({ orders, isDir });
}

// POST /api/shop/orders — passer une commande depuis le panier.
// body : { items: [{ productId, qty }], note }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const u = session.user as { id?: string; prenom?: string; name?: string | null };
  const userId = u.id ?? "";

  let body: { items?: { productId?: string; qty?: number }[]; note?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide." }, { status: 400 }); }
  const lines = (body.items || []).filter((i) => i.productId && (Number(i.qty) || 0) > 0);
  if (!lines.length) return NextResponse.json({ error: "Panier vide." }, { status: 400 });

  // On (re)lit les prix en base pour ne pas faire confiance au client.
  const ids = [...new Set(lines.map((l) => l.productId as string))];
  const products = await prisma.shopProduct.findMany({ where: { id: { in: ids }, active: true } }).catch(() => []) as { id: string; name: string; price: number }[];
  const byId = new Map(products.map((p) => [p.id, p]));

  const items = lines
    .map((l) => {
      const p = byId.get(l.productId as string);
      if (!p) return null;
      const qty = Math.min(99, Math.max(1, Math.round(Number(l.qty) || 1)));
      return { productId: p.id, name: p.name, unitPrice: p.price, qty };
    })
    .filter((x): x is { productId: string; name: string; unitPrice: number; qty: number } => x !== null);
  if (!items.length) return NextResponse.json({ error: "Aucun article valide." }, { status: 400 });

  const total = Math.round(items.reduce((s, i) => s + i.unitPrice * i.qty, 0) * 100) / 100;

  const created = await prisma.shopOrder.create({
    data: {
      userId,
      userName: u.prenom || u.name || "Utilisateur",
      total,
      note: (body.note || "").trim().slice(0, 1000) || null,
      items: { create: items },
    },
  }).catch(() => null);
  if (!created) return NextResponse.json({ error: "Commande impossible." }, { status: 500 });

  return NextResponse.json({ ok: true, id: created.id });
}
