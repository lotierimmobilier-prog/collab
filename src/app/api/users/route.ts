import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { saveUser } from "@/lib/user-write";
import { getExtras, setExtras } from "@/lib/user-extras";

// GET /api/users — liste tous les utilisateurs.
// On ne sélectionne que les colonnes RÉELLEMENT présentes dans « users », puis
// on fusionne les attributs de la table annexe user_extras (parrain, ville,
// statut salarié, GED, surcharges d'accès) qui en est la source de vérité.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`,
    );
    const have = new Set(colRows.map(c => c.column_name));
    const want = [
      { n: "id", s: "id" }, { n: "prenom", s: "prenom" }, { n: "nom", s: "nom" }, { n: "email", s: "email" },
      { n: "roleId", s: '"roleId"' }, { n: "active", s: "active" }, { n: "createdAt", s: '"createdAt"' },
      { n: "lastLogin", s: '"lastLogin"' }, { n: "avatar", s: "avatar" },
      { n: "parrainId", s: '"parrainId"' }, { n: "gedAccess", s: '"gedAccess"' }, { n: "city", s: "city" },
      { n: "isEmployee", s: '"isEmployee"' }, { n: "accessOverrides", s: '"accessOverrides"' },
    ];
    const cols = want.filter(c => have.has(c.n)).map(c => c.s);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT ${cols.join(", ")} FROM users ORDER BY "createdAt" DESC`,
    );

    // Fusion avec user_extras (source de vérité pour ces champs).
    const extras = await getExtras(rows.map(r => r.id));
    const merged = rows.map(r => {
      const ex = extras.get(r.id);
      if (!ex) return r;
      return {
        ...r,
        parrainId: ex.parrainId ?? r.parrainId ?? null,
        city: ex.city ?? r.city ?? null,
        isEmployee: ex.isEmployee ?? r.isEmployee ?? false,
        gedAccess: ex.gedAccess ?? r.gedAccess ?? null,
        accessOverrides: ex.accessOverrides ?? r.accessOverrides ?? null,
      };
    });
    return NextResponse.json(merged.map(fmt));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/users — créer un utilisateur
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prenom, nom, email, password, roleId, active, accessOverrides, gedAccess, parrainId, isEmployee, city } = body;
    if (!prenom || !nom || !email || !password || !roleId) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    // Colonnes de base sur « users » ; les attributs annexes (parrain, ville,
    // statut salarié, GED, surcharges d'accès) vont dans user_extras.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { prenom, nom, email: email.toLowerCase(), passwordHash, roleId, active: active ?? true };

    const sel = { id: true, prenom: true, nom: true, email: true, roleId: true, active: true };
    const user = await saveUser(() => prisma.user.create({ data, select: sel }), data);
    await setExtras(user.id, {
      parrainId: parrainId || null, city: city?.trim() || null,
      isEmployee: !!isEmployee, gedAccess: gedAccess || null,
      accessOverrides: accessOverrides ?? null,
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
