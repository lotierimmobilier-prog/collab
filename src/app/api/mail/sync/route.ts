import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require("imapflow");

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

  if (user)   return { senderType: "user",    senderId: user.id,   senderName: `${user.prenom} ${user.nom}` };
  if (owner)  return { senderType: "owner",   senderId: owner.id,  senderName: `${owner.prenom} ${owner.nom}` };
  if (tenant) return { senderType: "tenant",  senderId: tenant.id, senderName: `${tenant.prenom} ${tenant.nom}` };
  return { senderType: "unknown" };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  let { host, port, ssl, username, password } = body;
  const { accountId, page = 1, pageSize = 25 } = body;

  // Si accountId fourni → récupérer les credentials depuis la DB
  if (accountId && (!host || !password)) {
    const dbAcc = await prisma.mailAccountConfig.findUnique({ where: { id: accountId } });
    if (!dbAcc) return NextResponse.json({ ok: false, error: "Compte introuvable" }, { status: 404 });
    host     = dbAcc.host;
    port     = String(dbAcc.port);
    ssl      = dbAcc.ssl;
    username = dbAcc.username;
    password = dbAcc.password;
  }

  if (!host || !username || !password) {
    return NextResponse.json({ ok: false, error: "Paramètres incomplets" }, { status: 400 });
  }

  const client = makeClient(host, port, ssl, username, password);

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total: number = (client.mailbox as any)?.exists ?? 0;
    const totalPages    = total > 0 ? Math.ceil(total / pageSize) : 0;
    const messages: Array<Record<string, unknown>> = [];

    try {
      if (total > 0) {
        const from  = Math.max(1, total - page * pageSize + 1);
        const to    = Math.max(1, total - (page - 1) * pageSize);
        const range = `${from}:${to}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const msg of client.fetch(range, { uid: true, flags: true, envelope: true }) as AsyncIterable<any>) {
          const env     = msg.envelope ?? {};
          const flags   = msg.flags ?? new Set();
          const isUnread  = !flags.has("\\Seen");
          const isStarred = flags.has("\\Flagged");
          const fromEmail = env.from?.[0]?.address ?? "";

          const threadId = env.messageId
            ? env.messageId.replace(/[<>]/g, "").replace(/[^a-zA-Z0-9@._-]/g, "_")
            : `${accountId}-${msg.uid}`;

          const labels = ["inbox", ...(isStarred ? ["starred"] : [])];

          // Identifier l'expéditeur dans la base
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
              name:  a.name ?? a.address ?? "",
              email: a.address ?? "",
            })),
            subject:    env.subject ?? "(Sans objet)",
            body:       "",
            bodyText:   "",
            date:       env.date?.toISOString() ?? new Date().toISOString(),
            status:     isUnread ? "unread" : "read",
            labels,
            senderType: identity.senderType,
            senderId:   identity.senderId,
          };

          messages.push(msgObj);

          // Persister en BDD (upsert silencieux)
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
                date:       env.date ?? new Date(),
                read:       !isUnread,
                starred:    isStarred,
                threadId,
                labels,
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

    return NextResponse.json({
      ok: true,
      messages: messages.reverse(),
      count: messages.length,
      total,
      totalPages,
      page,
      message: `${messages.length} message(s) — page ${page}/${totalPages} (${total} au total)`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur de synchronisation";
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
