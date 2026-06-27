import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendNotificationEmail } from "@/lib/notify-mail";

const MAX_ATTACH_BYTES = 20 * 1024 * 1024; // 20 Mo
const ATTACH_TTL_DAYS  = 30;

interface Attachment { name: string; size: number; mime?: string; data: string }

// Purge paresseuse : retire les pièces jointes de plus de 30 jours (SQL brut
// pour éviter le typage Json nul de Prisma).
async function purgeOldAttachments() {
  await prisma.$executeRawUnsafe(
    `UPDATE internal_messages SET attachments = NULL
       WHERE attachments IS NOT NULL
         AND "createdAt" < now() - INTERVAL '${ATTACH_TTL_DAYS} days'`
  ).catch(() => {});
}

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

  await purgeOldAttachments();

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
    attachments: m.attachments ?? [],
    createdAt: m.createdAt.toISOString(),
    sender: m.sender,
    isMe: m.senderId === session.user!.id,
  })));
}

// POST — envoyer un message
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { channelId, content, attachments } = await req.json();
  const atts: Attachment[] = Array.isArray(attachments) ? attachments : [];
  const text = (content || "").trim();
  if (!channelId || (!text && atts.length === 0))
    return NextResponse.json({ error: "Message ou pièce jointe requis" }, { status: 400 });

  // Validation des pièces jointes : taille totale ≤ 20 Mo.
  const totalBytes = atts.reduce((s, a) => s + (Number(a.size) || Math.ceil((a.data?.length || 0) * 3 / 4)), 0);
  if (totalBytes > MAX_ATTACH_BYTES)
    return NextResponse.json({ error: "Pièces jointes trop volumineuses (max 20 Mo)" }, { status: 413 });

  const membership = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId: session.user.id } },
  });
  if (!membership) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const message = await prisma.internalMessage.create({
    data: {
      channelId,
      senderId: session.user.id,
      content: text,
      // Json optionnel : on omet le champ s'il n'y a pas de pièce jointe.
      ...(atts.length ? { attachments: atts as unknown as Prisma.InputJsonValue } : {}),
      readBy: [session.user.id],
    },
    include: { sender: { select: { id: true, prenom: true, nom: true, avatar: true } } },
  });

  // Notifications pour les autres membres du channel
  const others = await prisma.channelMember.findMany({
    where: { channelId, userId: { not: session.user.id } },
  });
  const senderName = `${session.user.prenom ?? ""} ${session.user.nom ?? ""}`.trim();
  const preview = text ? text.slice(0, 200) : `📎 ${atts.length} pièce(s) jointe(s)`;
  for (const m of others) {
    await prisma.notification.create({
      data: {
        userId: m.userId,
        type: "message",
        title: senderName,
        body: text ? text.slice(0, 100) : `📎 ${atts.length} pièce(s) jointe(s)`,
        link: "/messagerie-interne",
      },
    });
  }

  // Notification par email à chaque autre membre (best-effort).
  if (others.length) {
    const recipients = await prisma.user.findMany({
      where: { id: { in: others.map((o: { userId: string }) => o.userId) }, active: true },
      select: { email: true },
    });
    await Promise.all(recipients.map((r: { email: string }) => sendNotificationEmail({
      to: r.email,
      subject: `Nouveau message de ${senderName || "votre équipe"}`,
      heading: `Nouveau message de ${senderName || "votre équipe"}`,
      message: `${senderName || "Un membre de l'équipe"} vous a écrit :\n\n« ${preview} »`,
      ctaLabel: "Accéder à la conversation",
      ctaPath: `/messagerie-interne?channel=${channelId}`,
    })));
  }

  return NextResponse.json({
    id: message.id,
    channelId: message.channelId,
    content: message.content,
    attachments: atts,
    createdAt: message.createdAt.toISOString(),
    sender: message.sender,
    isMe: true,
  }, { status: 201 });
}
