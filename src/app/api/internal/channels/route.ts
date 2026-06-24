import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET — liste les channels de l'utilisateur connecté
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const memberships = await prisma.channelMember.findMany({
    where: { userId: session.user.id },
    include: {
      channel: {
        include: {
          members: { include: { user: { select: { id: true, prenom: true, nom: true, avatar: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const channels = memberships.map(m => {
    const ch = m.channel;
    const lastMsg = ch.messages[0] ?? null;
    const unread = ch.messages.filter(msg => !msg.readBy.includes(session.user!.id!)).length;
    return {
      id: ch.id,
      name: ch.isDirect
        ? ch.members.find(mb => mb.userId !== session.user!.id)?.user
            ? `${ch.members.find(mb => mb.userId !== session.user!.id)!.user.prenom} ${ch.members.find(mb => mb.userId !== session.user!.id)!.user.nom}`
            : ch.name
        : ch.name,
      isDirect: ch.isDirect,
      description: ch.description,
      members: ch.members.map(mb => ({ id: mb.user.id, prenom: mb.user.prenom, nom: mb.user.nom, avatar: mb.user.avatar })),
      lastMessage: lastMsg ? { content: lastMsg.content, createdAt: lastMsg.createdAt.toISOString() } : null,
      unread,
    };
  });

  return NextResponse.json(channels);
}

// POST — créer un channel (groupe ou conversation directe)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { name, description, isDirect, memberIds } = await req.json();

  // Pour une conv directe, vérifier si elle existe déjà
  if (isDirect && memberIds?.length === 1) {
    const otherId = memberIds[0];
    const existing = await prisma.channel.findFirst({
      where: {
        isDirect: true,
        members: { every: { userId: { in: [session.user.id, otherId] } } },
      },
      include: { members: true },
    });
    if (existing && existing.members.length === 2) {
      return NextResponse.json({ id: existing.id, existing: true });
    }
  }

  const allMembers = Array.from(new Set([session.user.id, ...(memberIds ?? [])]));

  const channel = await prisma.channel.create({
    data: {
      name: name || "Conversation",
      description: description || null,
      isDirect: isDirect ?? false,
      createdBy: session.user.id,
      members: { create: allMembers.map((uid: string) => ({ userId: uid })) },
    },
  });

  // Notification aux autres membres
  for (const uid of allMembers.filter((u: string) => u !== session.user!.id)) {
    await prisma.notification.create({
      data: {
        userId: uid,
        type: "message",
        title: isDirect ? "Nouveau message" : `Ajouté au groupe "${name}"`,
        body: isDirect ? `${session.user.prenom ?? ""} ${session.user.nom ?? ""}` : undefined,
        link: "/messagerie-interne",
      },
    });
  }

  return NextResponse.json({ id: channel.id }, { status: 201 });
}
