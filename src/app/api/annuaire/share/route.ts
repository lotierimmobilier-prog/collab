import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/superadmin";
import { sharedUserIds, addShare, removeShare } from "@/lib/annuaireShare";

function isSuper(session: { user?: { superAdmin?: boolean; email?: string | null } } | null): boolean {
  return session?.user?.superAdmin === true || isSuperAdminEmail(session?.user?.email);
}

// GET — liste des utilisateurs + qui est autorisé à voir l'annuaire du super
// admin. Réservé au super administrateur.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuper(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });

  const shared = new Set(await sharedUserIds());
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, prenom: true, nom: true, email: true, roleId: true },
    orderBy: [{ prenom: "asc" }, { nom: "asc" }],
  });
  return NextResponse.json({
    users: users.map(u => ({ ...u, shared: shared.has(u.id) })),
  });
}

// POST { userId, share } — autorise/retire l'accès d'un utilisateur à
// l'annuaire du super admin.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!isSuper(session)) return NextResponse.json({ error: "Réservé au super administrateur" }, { status: 403 });
  const { userId, share } = await req.json().catch(() => ({}));
  if (!userId || typeof userId !== "string") return NextResponse.json({ error: "userId requis" }, { status: 400 });
  if (share) await addShare(userId); else await removeShare(userId);
  return NextResponse.json({ ok: true });
}
