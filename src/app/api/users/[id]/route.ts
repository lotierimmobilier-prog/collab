import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { saveUser } from "@/lib/user-write";
import { setExtras } from "@/lib/user-extras";

// PATCH /api/users/[id] — modifier un utilisateur
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { prenom, nom, email, password, roleId, active, accessOverrides, gedAccess, parrainId, isEmployee, city } = body;

    // Colonnes de base sur « users ».
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (prenom !== undefined) data.prenom = prenom;
    if (nom !== undefined) data.nom = nom;
    if (email !== undefined) data.email = email.toLowerCase();
    if (roleId !== undefined) data.roleId = roleId;
    if (active !== undefined) data.active = active;
    if (password && password !== "••••••••") {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    // Attributs annexes → user_extras (table possédée par l'application).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extras: any = {};
    if (accessOverrides !== undefined) extras.accessOverrides = accessOverrides ?? null;
    if (gedAccess !== undefined) extras.gedAccess = gedAccess ?? null;
    if (parrainId !== undefined) extras.parrainId = parrainId || null;
    if (isEmployee !== undefined) extras.isEmployee = !!isEmployee;
    if (city !== undefined) extras.city = city?.trim() || null;

    const sel = { id: true, prenom: true, nom: true, email: true, roleId: true, active: true };
    const user = Object.keys(data).length
      ? await saveUser(() => prisma.user.update({ where: { id }, data, select: sel }), data)
      : await prisma.user.findUnique({ where: { id }, select: sel });
    if (Object.keys(extras).length) await setExtras(id, extras);
    return NextResponse.json({ ...user, password: "••••••••" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/users/[id] — supprimer un utilisateur
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
