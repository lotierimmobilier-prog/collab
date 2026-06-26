import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enrichSupplier } from "@/lib/supplier-enrich";
import { AugusteError } from "@/lib/auguste";

const ALLOWED = ["admin", "dirigeant", "direction", "gestionnaire", "syndic"];

// POST /api/fournisseurs/[id]/metier
//   Auguste devine le métier du fournisseur (recherche web + mails échangés).
//   body: { apply?: boolean }  (par défaut on applique si la confiance est bonne)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? "")) {
    return NextResponse.json({ error: "Réservé à la direction et à la gestion." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const s = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true, name: true, address: true, email: true, siret: true, metier: true, type: true },
  });
  if (!s) return NextResponse.json({ error: "Fournisseur introuvable." }, { status: 404 });

  try {
    const result = await enrichSupplier(s, { apply: body?.apply !== false });
    return NextResponse.json(result);
  } catch (e) {
    const err = e instanceof AugusteError ? e : new AugusteError(String(e));
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
}
