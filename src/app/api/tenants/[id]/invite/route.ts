import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendTenantWelcome } from "@/lib/client-invite";

// POST /api/tenants/[id]/invite — (ré)envoie l'email d'accès à l'espace locataire.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { email: true, prenom: true } });
  if (!tenant) return NextResponse.json({ error: "Locataire introuvable" }, { status: 404 });
  if (!tenant.email) return NextResponse.json({ error: "Ce locataire n'a pas d'adresse email." }, { status: 400 });

  const ok = await sendTenantWelcome(tenant);
  if (!ok) return NextResponse.json({ error: "L'envoi a échoué (configuration email)." }, { status: 502 });
  return NextResponse.json({ ok: true, to: tenant.email });
}
