import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET — récupérer les emails persistés en BDD
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const folder    = searchParams.get("folder")    || "INBOX";
  const accountId = searchParams.get("accountId") || undefined;
  const limit     = parseInt(searchParams.get("limit") || "100");

  const where: Record<string, unknown> = { folder };
  if (accountId) where.accountId = accountId;

  const messages = await prisma.emailMessage.findMany({
    where,
    orderBy: { date: "desc" },
    take: limit,
  });

  return NextResponse.json({ ok: true, messages });
}

// POST — sauvegarder un batch de messages
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { messages } = await req.json();
  if (!Array.isArray(messages)) return NextResponse.json({ error: "messages requis" }, { status: 400 });

  let saved = 0;
  for (const m of messages) {
    try {
      await prisma.emailMessage.upsert({
        where: { uid_accountId_folder: { uid: String(m.uid || m.id), accountId: m.accountId, folder: m.folder || "INBOX" } },
        create: {
          uid:        String(m.uid || m.id),
          messageId:  m.messageId,
          folder:     m.folder || "INBOX",
          accountId:  m.accountId,
          fromEmail:  m.from?.email || "",
          fromName:   m.from?.name,
          toEmail:    Array.isArray(m.to) ? m.to.map((t: { email: string }) => t.email).join(", ") : "",
          subject:    m.subject || "(Sans objet)",
          bodyText:   m.bodyText,
          bodyHtml:   m.body,
          date:       new Date(m.date),
          read:       m.status === "read",
          starred:    m.labels?.includes("starred") ?? false,
          attachments: m.attachments,
          threadId:   m.threadId,
          labels:     m.labels || ["inbox"],
          senderType: m.senderType,
          senderId:   m.senderId,
        },
        update: {
          read:    m.status === "read",
          starred: m.labels?.includes("starred") ?? false,
          labels:  m.labels || ["inbox"],
          bodyText: m.bodyText || undefined,
          bodyHtml: m.body    || undefined,
        },
      });
      saved++;
    } catch { /* skip doublons */ }
  }

  return NextResponse.json({ ok: true, saved });
}

// PATCH — marquer lu/étoile/labels/assignation sur un thread
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { ids, threadId, read, starred, addLabels, removeLabels, setLabels } = await req.json();

  const data: Record<string, unknown> = {};
  if (read    !== undefined) data.read    = read;
  if (starred !== undefined) data.starred = starred;

  if (setLabels !== undefined) {
    // Remplace tous les labels
    data.labels = setLabels;
    if (threadId) {
      await prisma.emailMessage.updateMany({ where: { threadId }, data });
      return NextResponse.json({ ok: true });
    }
  } else if (addLabels || removeLabels) {
    // Patch incrémental : récupère les messages et met à jour label par label
    const where = threadId ? { threadId } : { id: { in: ids as string[] } };
    const msgs  = await prisma.emailMessage.findMany({ where, select: { id: true, labels: true } });
    for (const m of msgs) {
      let lbls = [...m.labels];
      if (removeLabels) lbls = lbls.filter((l: string) => !(removeLabels as string[]).some(r => l === r || l.startsWith(r + ":")));
      if (addLabels)    lbls = [...lbls, ...(addLabels as string[]).filter((l: string) => !lbls.includes(l))];
      await prisma.emailMessage.update({ where: { id: m.id }, data: { labels: lbls } });
    }
    return NextResponse.json({ ok: true });
  }

  if (!Array.isArray(ids)) return NextResponse.json({ error: "ids requis" }, { status: 400 });
  await prisma.emailMessage.updateMany({ where: { id: { in: ids } }, data });
  return NextResponse.json({ ok: true });
}
