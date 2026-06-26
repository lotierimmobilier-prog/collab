import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// GET /api/users — liste tous les utilisateurs
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, prenom: true, nom: true, email: true,
        roleId: true, active: true, accessOverrides: true, gedAccess: true,
        createdAt: true, lastLogin: true, avatar: true,
      },
    });
    return NextResponse.json(users.map((u: typeof users[number]) => ({
      ...u,
      createdAt: u.createdAt.toLocaleDateString("fr-FR"),
      lastLogin: u.lastLogin?.toLocaleDateString("fr-FR"),
      accessOverrides: u.accessOverrides ?? undefined,
      password: "••••••••", // jamais exposé
    })));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/users — créer un utilisateur
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prenom, nom, email, password, roleId, active, accessOverrides, gedAccess } = body;
    if (!prenom || !nom || !email || !password || !roleId) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        prenom, nom, email: email.toLowerCase(), passwordHash,
        roleId, active: active ?? true,
        accessOverrides: accessOverrides ?? undefined,
        gedAccess: gedAccess ?? null,
      },
    });
    return NextResponse.json({ ...user, password: "••••••••" }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
