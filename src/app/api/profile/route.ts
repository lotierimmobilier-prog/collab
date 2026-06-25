import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";

/** GET /api/profile → profil de l'utilisateur connecté. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, prenom: true, nom: true, email: true, phone: true, roleId: true },
  });
  if (!user) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(user);
}

/**
 * PATCH /api/profile
 *  - { phone } : met à jour le téléphone
 *  - { currentPassword, newPassword } : change le mot de passe (vérifie l'actuel)
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  // Téléphone
  if (body.phone !== undefined) {
    data.phone = String(body.phone).trim() || null;
  }

  // Changement de mot de passe
  if (body.newPassword) {
    if (!body.currentPassword) return NextResponse.json({ error: "Mot de passe actuel requis" }, { status: 400 });
    if (String(body.newPassword).length < 6) return NextResponse.json({ error: "Le nouveau mot de passe doit faire au moins 6 caractères" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
    if (!user) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    const ok = await bcrypt.compare(String(body.currentPassword), user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });

    data.passwordHash = await bcrypt.hash(String(body.newPassword), 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Rien à mettre à jour" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: session.user.id }, data });
  return NextResponse.json({ ok: true });
}
