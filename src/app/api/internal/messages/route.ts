import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET — messages d'un channel, avec marquage "lu"
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId requis" }, { status: 400 });

  // Vérifier que l'utilisateur est membre
  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const messages = await prisma.internalMessage.findMany({
    where: { channelId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { sender: { select: { id: true, prenom: true, nom: true, avatar: true } } },
  });

  // Marquer comme lu
  const unreadIds = messages.filter(m => !m.readBy.includes(session.user!.id!)).map(m => m.id);
  if (unreadIds.length > 0) {
    await prisma.internalMessage.updateMany({
      where: { id: { in: unreadIds } },
      data: { readBy: { push: session.user.id } },
    });
  }

  return NextResponse.json(messages.map(m => ({
    id: m.id,
    channelId: m.channelId,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    sender: m.sender,
    isMe: m.senderId === session.user!.id,
  })));
}

// POST — envoyer un message
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { channelId, content } = await req.json();
  if (!channelId || !content?.trim()) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const message = await prisma.internalMessage.create({
    data: {
      channelId,
      senderId: session.user.id,
      content: content.trim(),
      readBy: [session.user.id],
    },
    include: { sender: { select: { id: true, prenom: true, nom: true, avatar: true } } },
  });

  // Notifications pour les autres membres du channel
  const others = await prisma.channelMember.findMany({
    where: { channelId, userId: { not: session.user.id } },
  });
  for (const m of others) {
    await prisma.notification.create({
      data: {
        userId: m.userId,
        type: "message",
        title: `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`,
        body: content.trim().slice(0, 100),
        link: "/messagerie-interne",
      },
    });
  }

  return NextResponse.json({
    id: message.id,
    channelId: message.channelId,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    sender: message.sender,
    isMe: true,
  }, { status: 201 });
}
