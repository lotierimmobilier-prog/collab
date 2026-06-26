import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { saveUser } from "@/lib/user-write";

// GET /api/users — liste tous les utilisateurs.
// Résilient : si une colonne récente manque encore en base (migration non
// appliquée), on retombe sur une sélection minimale plutôt que de renvoyer 500.
export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fmt = (u: any) => ({
    ...u,
    createdAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString("fr-FR") : null,
    lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleDateString("fr-FR") : undefined,
    accessOverrides: u.accessOverrides ?? undefined,
    password: "••••••••", // jamais exposé
  });

  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, prenom: true, nom: true, email: true,
        roleId: true, active: true, accessOverrides: true, gedAccess: true,
        createdAt: true, lastLogin: true, avatar: true, parrainId: true,
      },
    });
    return NextResponse.json(users.map(fmt));
  } catch (e) {
    // Repli : colonnes de base uniquement (compatibilité bases non migrées).
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = await prisma.$queryRaw`
        SELECT id, prenom, nom, email, "roleId", active, "createdAt", "lastLogin"
        FROM users ORDER BY "createdAt" DESC`;
      return NextResponse.json(rows.map(fmt));
    } catch (e2) {
      return NextResponse.json({ error: String(e), fallbackError: String(e2) }, { status: 500 });
    }
  }
}

// POST /api/users — créer un utilisateur
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prenom, nom, email, password, roleId, active, accessOverrides, gedAccess, parrainId } = body;
    if (!prenom || !nom || !email || !password || !roleId) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {
      prenom, nom, email: email.toLowerCase(), passwordHash,
      roleId, active: active ?? true,
      accessOverrides: accessOverrides ?? undefined,
    };
    if (gedAccess) data.gedAccess = gedAccess;
    if (parrainId) data.parrainId = parrainId;

    const sel = { id: true, prenom: true, nom: true, email: true, roleId: true, active: true };
    const user = await saveUser(() => prisma.user.create({ data, select: sel }), data);
    return NextResponse.json({ ...user, password: "••••••••" }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
