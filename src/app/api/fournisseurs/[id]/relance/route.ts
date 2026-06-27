import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendConfReminder, ensurePortalToken } from "@/lib/supplier-conformite";

const ALLOWED = ["admin", "dirigeant", "direction", "gestionnaire", "syndic"];

// POST /api/fournisseurs/[id]/relance — envoie maintenant la relance
// « justificatifs à jour » (assurance / URSSAF) au fournisseur.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? ""))
    return NextResponse.json({ error: "Réservé à la direction et à la gestion." }, { status: 403 });

  const { id } = await params;
  const s = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, portalToken: true, insuranceExpiry: true, urssafExpiry: true },
  });
  if (!s) return NextResponse.json({ error: "Fournisseur introuvable." }, { status: 404 });
  if (!s.email) return NextResponse.json({ error: "Ce fournisseur n'a pas d'adresse email." }, { status: 400 });

  const r = await sendConfReminder(s);
  if (!r.ok) return NextResponse.json({ error: r.error || "Envoi impossible." }, { status: 502 });
  return NextResponse.json({ ok: true, sentTo: s.email });
}

// GET /api/fournisseurs/[id]/relance — renvoie (et crée au besoin) le lien de
// l'espace fournisseur, pour le copier/partager.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? ""))
    return NextResponse.json({ error: "Réservé à la direction et à la gestion." }, { status: 403 });

  const { id } = await params;
  const s = await prisma.supplier.findUnique({ where: { id }, select: { id: true, portalToken: true } });
  if (!s) return NextResponse.json({ error: "Fournisseur introuvable." }, { status: 404 });
  const token = await ensurePortalToken(s.id, s.portalToken);
  const base = process.env.NEXTAUTH_URL || "https://collab.lotier-immobilier.com";
  return NextResponse.json({ url: `${base}/fournisseur/${token}` });
}
