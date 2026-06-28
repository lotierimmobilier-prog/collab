import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveAccountOwners } from "@/lib/mailOwner";
import { blockedSendersFor } from "@/lib/mailBlocklist";

// GET — récupérer les emails persistés en BDD
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const folderParam = searchParams.get("folder");      // absent ou "all" = tous les dossiers
  const accountId = searchParams.get("accountId") || undefined;
  const limit     = parseInt(searchParams.get("limit") || "100");

  const since = new Date();
  since.setMonth(since.getMonth() - 6);

  const where: Record<string, unknown> = { date: { gte: since } };
  if (folderParam && folderParam !== "all") where.folder = folderParam;
  if (accountId) where.accountId = accountId;

  // Cloisonnement mail : chacun ne voit que ses propres mails. L'admin paramètre
  // les boîtes mais n'accède PAS à leur contenu (il faut être l'agent assigné).
  // Visible si : compte dont je suis l'agent (sharedUserIds) OU message qui m'est
  // rattaché (ownerId).
  const uid = session.user.id;
  const configs = await prisma.mailAccountConfig.findMany({
    where: { sharedUserIds: { has: uid } },
    select: { id: true },
  });
  const allowed = configs.map(c => c.id);
  where.OR = [{ accountId: { in: allowed } }, { ownerId: uid }];
  // Ne jamais renvoyer les messages supprimés définitivement (tombstones).
  where.NOT = { labels: { has: "deleted" } };

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

  // Propriétaire de chaque message = agent de la boîte (config), sinon
  // l'utilisateur courant (comptes Gmail/local côté client).
  const ownerByAccount = await resolveAccountOwners(messages.map((m: { accountId?: string }) => m.accountId || ""));
  const ownerFor = (accId?: string) => (accId && ownerByAccount.get(accId)) || session.user.id;

  // Expéditeurs indésirables → classés directement en corbeille à la réception.
  const blockedByOwner = await blockedSendersFor([...new Set([...ownerByAccount.values(), session.user.id])]);
  const isSpam = (accId: string | undefined, fromEmail: string | undefined) => {
    const set = blockedByOwner.get(ownerFor(accId));
    return !!set && !!fromEmail && set.has(fromEmail.trim().toLowerCase());
  };

  // Tombstones : messages supprimés/mis en corbeille à ne pas ressusciter.
  // On reconnaît par (uid+compte+dossier) ET par Message-ID stable (au cas où
  // le serveur change l'UID au resync).
  const msgIds = [...new Set(messages.map((m: { messageId?: string }) => m.messageId).filter(Boolean) as string[])];
  const tomb = await prisma.emailMessage.findMany({
    where: {
      labels: { hasSome: ["deleted", "trash"] },
      OR: [
        ...messages.map((m: { uid?: string; id?: string; accountId?: string; folder?: string }) => ({ uid: String(m.uid || m.id), accountId: m.accountId, folder: m.folder || "INBOX" })),
        ...(msgIds.length ? [{ messageId: { in: msgIds } }] : []),
      ],
    },
    select: { uid: true, accountId: true, folder: true, messageId: true },
  }).catch(() => [] as { uid: string; accountId: string; folder: string; messageId: string | null }[]);
  const tombSet = new Set(tomb.map(t => `${t.uid}|${t.accountId}|${t.folder}`));
  const tombMid = new Set(tomb.map(t => t.messageId).filter(Boolean) as string[]);

  let saved = 0;
  for (const m of messages) {
    try {
      if (tombSet.has(`${String(m.uid || m.id)}|${m.accountId}|${m.folder || "INBOX"}`)) continue;
      if (m.messageId && tombMid.has(m.messageId)) continue;
      const spam = isSpam(m.accountId, m.from?.email);
      const labels = spam ? ["trash"] : (m.labels || ["inbox"]);
      const read = spam ? true : (m.status === "read");
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
          read,
          starred:    m.labels?.includes("starred") ?? false,
          attachments: m.attachments,
          threadId:   m.threadId,
          labels,
          senderType: m.senderType,
          senderId:   m.senderId,
          ownerId:    ownerFor(m.accountId),
        },
        update: {
          read,
          starred: m.labels?.includes("starred") ?? false,
          labels,
          bodyText: m.bodyText || undefined,
          bodyHtml: m.body    || undefined,
          ownerId:  ownerFor(m.accountId),
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

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  // mode=trash : mise à la corbeille (la ligne reste, libellée « trash ») ;
  // défaut (permanent) : suppression définitive (tombstone « deleted »).
  // Dans LES DEUX cas on supprime la copie sur le serveur IMAP, sinon elle
  // revient à la synchronisation suivante.
  const mode = searchParams.get("mode") === "trash" ? "trash" : "permanent";
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const msg = await prisma.emailMessage.findUnique({ where: { id }, select: { uid: true, accountId: true, folder: true } }).catch(() => null);
  if (!msg) return NextResponse.json({ ok: true });

  // 1) Suppression côté serveur IMAP (best effort) : sans ça, le mail revient à
  //    la prochaine synchronisation. Vaut pour tous les agents de la boîte.
  let serverDeleted = false;
  if (msg.accountId && msg.uid) {
    try {
      const { deleteFromImapServer } = await import("@/lib/mailImapDelete");
      serverDeleted = await deleteFromImapServer(msg.accountId, msg.uid, msg.folder);
    } catch { /* ignore */ }
  }

  // 2) Côté base : corbeille → on garde la ligne en « trash » (récupérable dans
  //    l'app) ; suppression définitive → tombstone « deleted ». La synchro ne
  //    réécrit pas les labels → le message ne réapparaît plus dans la boîte.
  const labels = mode === "trash" ? ["trash"] : ["deleted"];
  await prisma.emailMessage.update({ where: { id }, data: { labels, read: true } }).catch(() => {});
  return NextResponse.json({ ok: true, serverDeleted, mode });
}
