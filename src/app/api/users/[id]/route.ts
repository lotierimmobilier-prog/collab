import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { saveUser } from "@/lib/user-write";
import { setExtras, getExtra } from "@/lib/user-extras";
import { isSuperAdminEmail, isAdminRole } from "@/lib/superadmin";
import { notifyParrainageAssigned } from "@/lib/formation-notify";

// PATCH /api/users/[id] — modifier un utilisateur
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
    const callerSuper = session.user.superAdmin === true || isSuperAdminEmail(session.user.email);

    const body = await req.json();
    const { prenom, nom, email, password, roleId, active, accessOverrides, gedAccess, parrainId, isEmployee, city, superAdmin } = body;

    // État actuel de la cible (rôle, adresse, statut super) pour la gouvernance.
    const target = await prisma.user.findUnique({ where: { id }, select: { roleId: true, email: true } });
    const targetExtras = await getExtra(id);
    const targetIsBootstrap = isSuperAdminEmail(target?.email);
    const targetIsSuper = targetIsBootstrap || targetExtras?.superAdmin === true;
    const targetIsAdmin = isAdminRole(target?.roleId);

    // Un super admin ne peut être modifié que par un super admin.
    if (targetIsSuper && !callerSuper) {
      return NextResponse.json({ error: "Seul le super administrateur peut modifier un super administrateur." }, { status: 403 });
    }
    // Le super admin d'origine est immuable (rôle, activation, statut super).
    if (targetIsBootstrap) {
      if (roleId !== undefined && roleId !== "admin") return NextResponse.json({ error: "Le super administrateur d'origine ne peut pas changer de rôle." }, { status: 403 });
      if (active === false) return NextResponse.json({ error: "Le super administrateur d'origine ne peut pas être désactivé." }, { status: 403 });
      if (superAdmin === false) return NextResponse.json({ error: "Le super administrateur d'origine ne peut pas perdre ce statut." }, { status: 403 });
    }
    // Seul le super admin promeut au rang d'administrateur…
    if (roleId !== undefined && isAdminRole(roleId) && !callerSuper) {
      return NextResponse.json({ error: "Seul le super administrateur peut nommer un administrateur." }, { status: 403 });
    }
    // …modifie les droits modules d'un administrateur…
    if (accessOverrides !== undefined && targetIsAdmin && !callerSuper) {
      return NextResponse.json({ error: "Seul le super administrateur peut modifier les droits d'un administrateur." }, { status: 403 });
    }
    // …désigne/retire un super admin…
    if (superAdmin !== undefined && !callerSuper) {
      return NextResponse.json({ error: "Seul le super administrateur peut désigner un super administrateur." }, { status: 403 });
    }
    // …et modifie un autre compte administrateur.
    if (targetIsAdmin && !callerSuper && id !== session.user.id) {
      return NextResponse.json({ error: "Seul le super administrateur peut modifier un compte administrateur." }, { status: 403 });
    }

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
    // Affectation d'un parrain : on note l'ancienne valeur pour ne notifier
    // que sur un vrai changement vers un nouveau parrain.
    let newParrainId: string | null = null, prevParrainId: string | null = null;
    if (parrainId !== undefined) {
      newParrainId = parrainId || null;
      prevParrainId = (await getExtra(id))?.parrainId ?? null;
      extras.parrainId = newParrainId;
    }
    if (isEmployee !== undefined) extras.isEmployee = !!isEmployee;
    if (city !== undefined) extras.city = city?.trim() || null;
    if (superAdmin !== undefined && callerSuper) extras.superAdmin = !!superAdmin;

    const sel = { id: true, prenom: true, nom: true, email: true, roleId: true, active: true };
    const user = Object.keys(data).length
      ? await saveUser(() => prisma.user.update({ where: { id }, data, select: sel }), data)
      : await prisma.user.findUnique({ where: { id }, select: sel });
    if (Object.keys(extras).length) await setExtras(id, extras);
    if (newParrainId && newParrainId !== prevParrainId) {
      after(() => notifyParrainageAssigned(id, newParrainId!));
    }
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
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
    const callerSuper = session.user.superAdmin === true || isSuperAdminEmail(session.user.email);

    const target = await prisma.user.findUnique({ where: { id }, select: { roleId: true, email: true } });
    const targetExtras = await getExtra(id);
    if (isSuperAdminEmail(target?.email)) {
      return NextResponse.json({ error: "Le super administrateur d'origine ne peut pas être supprimé." }, { status: 403 });
    }
    const targetIsSuper = targetExtras?.superAdmin === true;
    if ((targetIsSuper || isAdminRole(target?.roleId)) && !callerSuper) {
      return NextResponse.json({ error: "Seul le super administrateur peut supprimer un administrateur." }, { status: 403 });
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
