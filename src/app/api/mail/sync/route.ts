import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require("imapflow");

const PAGE_SIZE   = 30;   // messages par page
const MONTHS_BACK = 6;    // limite temporelle

function makeClient(host: string, port: string, ssl: boolean, username: string, password: string) {
  return new ImapFlow({
    host, port: parseInt(port), secure: ssl,
    auth: { user: username, pass: password },
    logger: false, connectionTimeout: 20000, greetingTimeout: 8000, socketTimeout: 30000,
  });
}

async function identifySender(email: string): Promise<{ senderType: string; senderId?: string; senderName?: string }> {
  if (!email) return { senderType: "unknown" };
  const [user, owner, tenant] = await Promise.all([
    prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, prenom: true, nom: true } }),
    prisma.owner.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, prenom: true, nom: true } }),
    prisma.tenant.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, prenom: true, nom: true } }),
  ]);
  if (user)   return { senderType: "user",   senderId: user.id,   senderName: `${user.prenom} ${user.nom}` };
  if (owner)  return { senderType: "owner",  senderId: owner.id,  senderName: `${owner.prenom} ${owner.nom}` };
  if (tenant) return { senderType: "tenant", senderId: tenant.id, senderName: `${tenant.prenom} ${tenant.nom}` };
  return { senderType: "unknown" };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  let { host, port, ssl, username, password } = body;
  const { accountId, page = 1 } = body;

  // Résoudre les credentials depuis la DB si accountId fourni
  if (accountId && (!host || !password)) {
    const dbAcc = await prisma.mailAccountConfig.findUnique({ where: { id: accountId } });
    if (!dbAcc) return NextResponse.json({ ok: false, error: "Compte introuvable" }, { status: 404 });
    host = dbAcc.host; port = String(dbAcc.port); ssl = dbAcc.ssl; username = dbAcc.username; password = dbAcc.password;
  }

  if (!host || !username || !password) {
    return NextResponse.json({ ok: false, error: "Paramètres incomplets" }, { status: 400 });
  }

  // Limite 6 mois
  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS_BACK);

  const client = makeClient(host, port, ssl, username, password);

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const messages: Array<Record<string, unknown>> = [];

    try {
      // Recherche IMAP des UIDs depuis 6 mois (du plus récent au plus ancien)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matchedUids: number[] = await (client as any).search({ since }, { uid: true });
      matchedUids.sort((a, b) => b - a); // plus récent en premier

      const total      = matchedUids.length;
      const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 0;
      const pageUids   = matchedUids.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

      if (pageUids.length > 0) {
        const uidSet = pageUids.join(",");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const msg of (client as any).fetch(uidSet, { uid: true, flags: true, envelope: true }, { uid: true }) as AsyncIterable<any>) {
          const env       = msg.envelope ?? {};
          const flags     = msg.flags ?? new Set();
          const isUnread  = !flags.has("\\Seen");
          const isStarred = flags.has("\\Flagged");
          const fromEmail = env.from?.[0]?.address ?? "";
          const msgDate   = env.date ? new Date(env.date) : new Date();

          // Ne conserver que les 6 derniers mois (double-vérification côté serveur)
          if (msgDate < since) continue;

          const threadId = env.messageId
            ? env.messageId.replace(/[<>]/g, "").replace(/[^a-zA-Z0-9@._-]/g, "_")
            : `${accountId}-${msg.uid}`;

          const identity = await identifySender(fromEmail);

          const msgObj = {
            id:       `${accountId}-${msg.uid}`,
            uid:      msg.uid,
            threadId,
            accountId,
            from: {
              name:  env.from?.[0]?.name ?? env.from?.[0]?.address ?? "Inconnu",
              email: fromEmail,
            },
            to: (env.to ?? []).map((a: { name?: string; address?: string }) => ({
              name:  a.name  ?? a.address ?? "",
              email: a.address ?? "",
            })),
            subject:    env.subject ?? "(Sans objet)",
            body:       "",
            bodyText:   "",
            date:       msgDate.toISOString(),
            status:     isUnread ? "unread" : "read",
            labels:     ["inbox", ...(isStarred ? ["starred"] : [])],
            senderType: identity.senderType,
            senderId:   identity.senderId,
          };

          messages.push(msgObj);

          // Persister en DB (upsert)
          try {
            await prisma.emailMessage.upsert({
              where: { uid_accountId_folder: { uid: String(msg.uid), accountId, folder: "INBOX" } },
              create: {
                uid:        String(msg.uid),
                messageId:  env.messageId?.replace(/[<>]/g, ""),
                folder:     "INBOX",
                accountId,
                fromEmail,
                fromName:   env.from?.[0]?.name,
                toEmail:    (env.to ?? []).map((a: { address?: string }) => a.address).filter(Boolean).join(", "),
                subject:    env.subject ?? "(Sans objet)",
                date:       msgDate,
                read:       !isUnread,
                starred:    isStarred,
                threadId,
                labels:     ["inbox", ...(isStarred ? ["starred"] : [])],
                senderType: identity.senderType,
                senderId:   identity.senderId,
              },
              update: {
                read:       !isUnread,
                starred:    isStarred,
                senderType: identity.senderType,
                senderId:   identity.senderId,
              },
            });
          } catch { /* ignore contrainte unique */ }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    const total      = (await prisma.emailMessage.count({ where: { accountId, folder: "INBOX", date: { gte: since } } }));
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

    return NextResponse.json({
      ok: true,
      messages,
      count: messages.length,
      total,
      totalPages,
      page,
      since: since.toISOString(),
      message: `${messages.length} message(s) — page ${page}/${totalPages} (${total} sur 6 mois)`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur de synchronisation";
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
