import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/superadmin";
import { normalizeAccountOwnership } from "@/lib/mailOwner";

// Gouvernance des boîtes mail :
//  - le super admin crée/modifie/partage les boîtes et voit tout (gestion) ;
//  - un utilisateur ne voit que SA boîte perso + les boîtes partagées avec lui ;
//    il peut les consulter et écrire, mais PAS modifier la config (mdp, partage…).
function isSuper(session: { user?: { superAdmin?: boolean; email?: string | null; impersonatorId?: string | null } } | null): boolean {
  // Pendant une impersonation, on n'est JAMAIS super admin : l'admin qui consulte
  // « en tant que » un agent ne doit voir que les boîtes de cet agent.
  if (session?.user?.impersonatorId) return false;
  return session?.user?.superAdmin === true || isSuperAdminEmail(session?.user?.email);
}

// GET — comptes accessibles à l'utilisateur connecté
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = session.user.id;

  const accounts = await prisma.mailAccountConfig.findMany({
    // Super admin : les boîtes PARTAGÉES (qu'il gère) + ses propres boîtes +
    // celles partagées avec lui — mais PAS les boîtes personnelles des autres.
    // Autres : les boîtes partagées avec eux + leur boîte personnelle.
    where: isSuper(session) ? {
      OR: [
        { isShared: true },
        { createdBy: userId },
        { sharedUserIds: { has: userId } },
      ],
    } : {
      OR: [
        { sharedUserIds: { has: userId } },
        { createdBy: userId, isShared: false },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  const superAdmin = isSuper(session);
  return NextResponse.json(accounts.map(a => ({
    ...a,
    // Ne jamais exposer le mot de passe au client (on garde en DB mais on masque)
    password: "••••••••",
    // Indique au client si l'utilisateur peut gérer cette boîte (config/mdp/partage).
    canManage: superAdmin || (a.createdBy === userId && !a.isShared),
  })));
}

// POST — créer un compte d'agence
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { label, email, name, protocol, host, port, ssl, username, password,
          smtpHost, smtpPort, smtpSsl, color, sharedUserIds, isShared } = body;

  if (!email || !host) return NextResponse.json({ error: "Email et hôte requis" }, { status: 400 });

  // Une boîte n'est « partagée » (réservée au super administrateur) que si elle
  // est accessible à un agent AUTRE que son créateur. Une boîte PERSONNELLE —
  // même créée via « Connexion rapide » (isShared=true mais partagée seulement
  // avec soi-même) — reste enregistrable par l'agent lui-même. Sans cette
  // nuance, un agent ne pouvait pas enregistrer sa propre boîte (403) : elle ne
  // « restait pas en mémoire ».
  const ids: string[] = Array.isArray(sharedUserIds) ? sharedUserIds.filter(Boolean) : [];
  const sharedWithOthers = ids.some(id => id !== session.user.id);
  if (sharedWithOthers && !isSuper(session)) {
    return NextResponse.json({ error: "Seul le super administrateur peut partager une boîte mail avec d'autres agents." }, { status: 403 });
  }

  // Agents ayant accès à la boîte. Le créateur a toujours accès à sa propre
  // boîte. Une boîte personnelle (partagée avec personne d'autre) est stockée
  // comme non partagée, pour que l'agent puisse la gérer.
  const agents: string[] = [...ids];
  if (!sharedWithOthers && !agents.includes(session.user.id)) {
    agents.push(session.user.id);
  }
  const effIsShared = sharedWithOthers ? (isShared ?? false) : false;

  const account = await prisma.mailAccountConfig.create({
    data: {
      label:         label || email,
      email,
      name:          name || email,
      protocol:      protocol || "imap",
      host,
      port:          Number(port) || 993,
      ssl:           ssl ?? true,
      username:      username || email,
      password:      password || "",
      smtpHost:      smtpHost || "",
      smtpPort:      Number(smtpPort) || 587,
      smtpSsl:       smtpSsl ?? true,
      color:         color || "#B8966A",
      active:        true,
      isShared:      effIsShared,
      sharedUserIds: agents,
      createdBy:     session.user.id,
    },
  });

  return NextResponse.json({ ...account, password: "••••••••" }, { status: 201 });
}

// PATCH — modifier (accès, partage...)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { id, sharedUserIds, isShared, label, color, active, password,
          smtpHost, smtpPort, smtpSsl, action } = body;

  const existing = await prisma.mailAccountConfig.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Action « réparer le cloisonnement » : ré-affecte les messages de la boîte à
  // son agent légitime (purge les fuites héritées d'une synchro antérieure).
  if (action === "repair") {
    if (!isSuper(session)) return NextResponse.json({ error: "Réservé au super administrateur." }, { status: 403 });
    const fixed = await normalizeAccountOwnership(id);
    return NextResponse.json({ ok: true, repaired: fixed });
  }
  // Modifier une boîte (config, mot de passe, partage) : super admin, ou le
  // créateur d'une boîte personnelle. Les utilisateurs avec qui une boîte est
  // partagée ne peuvent PAS la modifier.
  const canManage = isSuper(session) || (existing.createdBy === session.user.id && !existing.isShared);
  if (!canManage) return NextResponse.json({ error: "Seul le super administrateur peut modifier cette boîte mail." }, { status: 403 });
  // Seul le super admin peut (re)partager une boîte.
  if ((sharedUserIds !== undefined || isShared !== undefined) && !isSuper(session)) {
    return NextResponse.json({ error: "Seul le super administrateur peut gérer le partage d'une boîte." }, { status: 403 });
  }

  const updated = await prisma.mailAccountConfig.update({
    where: { id },
    data: {
      ...(sharedUserIds !== undefined && { sharedUserIds }),
      ...(isShared !== undefined && { isShared }),
      ...(label    !== undefined && { label }),
      ...(color    !== undefined && { color }),
      ...(active   !== undefined && { active }),
      ...(password && password !== "••••••••" && { password }),
      ...(smtpHost !== undefined && { smtpHost }),
      ...(smtpPort !== undefined && { smtpPort: Number(smtpPort) }),
      ...(smtpSsl  !== undefined && { smtpSsl }),
    },
  });

  // Si le partage a changé, on ré-affecte les messages de la boîte à son agent
  // légitime : un agent retiré cesse immédiatement de voir le courrier.
  let repaired = 0;
  if (sharedUserIds !== undefined || isShared !== undefined) {
    repaired = await normalizeAccountOwnership(id);
  }

  return NextResponse.json({ ...updated, password: "••••••••", repaired });
}

// DELETE
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await req.json();
  const existing = await prisma.mailAccountConfig.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const canManage = isSuper(session) || (existing.createdBy === session.user.id && !existing.isShared);
  if (!canManage) return NextResponse.json({ error: "Seul le super administrateur peut supprimer cette boîte mail." }, { status: 403 });

  await prisma.mailAccountConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
