import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { saveUser } from "@/lib/user-write";

// PATCH /api/users/[id] — modifier un utilisateur
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { prenom, nom, email, password, roleId, active, accessOverrides, gedAccess, parrainId, isEmployee, city } = body;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};
    if (prenom !== undefined) data.prenom = prenom;
    if (nom !== undefined) data.nom = nom;
    if (email !== undefined) data.email = email.toLowerCase();
    if (roleId !== undefined) data.roleId = roleId;
    if (active !== undefined) data.active = active;
    if (accessOverrides !== undefined) data.accessOverrides = accessOverrides ?? null;
    if (gedAccess !== undefined) data.gedAccess = gedAccess ?? null;
    if (parrainId !== undefined) data.parrainId = parrainId || null;
    if (isEmployee !== undefined) data.isEmployee = !!isEmployee;
    if (city !== undefined) data.city = city?.trim() || null;
    if (password && password !== "••••••••") {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    const sel = { id: true, prenom: true, nom: true, email: true, roleId: true, active: true };
    const user = await saveUser(() => prisma.user.update({ where: { id }, data, select: sel }), data);
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
