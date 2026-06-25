import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET — comptes accessibles à l'utilisateur connecté
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const userId = session.user.id;

  const accounts = await prisma.mailAccountConfig.findMany({
    where: {
      OR: [
        { createdBy: userId },
        { sharedUserIds: { has: userId } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(accounts.map(a => ({
    ...a,
    // Ne jamais exposer le mot de passe au client (on garde en DB mais on masque)
    password: "••••••••",
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

  // Agents ayant accès à la boîte. Si ce n'est PAS un admin qui crée la boîte,
  // c'est sa propre boîte → il en devient l'agent. Un admin paramètre pour un
  // agent : il renseigne sharedUserIds et ne s'ajoute pas lui-même (il n'a pas
  // accès au contenu).
  const agents: string[] = Array.isArray(sharedUserIds) ? [...sharedUserIds] : [];
  if (session.user.roleId !== "admin" && !agents.includes(session.user.id)) {
    agents.push(session.user.id);
  }

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
      isShared:      isShared ?? false,
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
          smtpHost, smtpPort, smtpSsl } = body;

  const existing = await prisma.mailAccountConfig.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (existing.createdBy !== session.user.id) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

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

  return NextResponse.json({ ...updated, password: "••••••••" });
}

// DELETE
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { id } = await req.json();
  const existing = await prisma.mailAccountConfig.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (existing.createdBy !== session.user.id) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  await prisma.mailAccountConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
