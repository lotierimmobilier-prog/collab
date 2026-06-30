import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendWelcomeEmail } from "@/lib/welcome";

// POST /api/users/[id]/welcome — (re)envoyer l'email de bienvenue + lien de
// création de mot de passe à un utilisateur déjà inscrit. Réservé à l'admin.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, prenom: true, email: true } }).catch(() => null);
  if (!user) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

  const sent = await sendWelcomeEmail({ id: user.id, prenom: user.prenom, email: user.email }).catch(() => false);
  if (!sent) {
    return NextResponse.json({ ok: false, error: "L'email n'a pas pu être envoyé. Vérifiez la configuration SMTP." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, to: user.email });
}
