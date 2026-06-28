import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { accessibleMailAccount } from "@/lib/mailOwner";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require("imapflow");

function makeClient(host: string, port: string, ssl: boolean, username: string, password: string) {
  return new ImapFlow({
    host, port: parseInt(port), secure: ssl,
    auth: { user: username, pass: password },
    logger: false, connectionTimeout: 20000, greetingTimeout: 8000, socketTimeout: 30000,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Non authentifié" }, { status: 401 });

  const { host, port, ssl, username, password, accountId, query } = await req.json();

  if (!host || !username || !password || !query) {
    return NextResponse.json({ ok: false, error: "Paramètres incomplets" }, { status: 400 });
  }

  // Cloisonnement : si la recherche cible une boîte gérée en base, l'utilisateur
  // doit en être agent.
  if (accountId) {
    const exists = await prisma.mailAccountConfig.findUnique({ where: { id: accountId }, select: { id: true } });
    if (exists && !(await accessibleMailAccount(session.user.id, accountId))) {
      return NextResponse.json({ ok: false, error: "Accès non autorisé à cette boîte" }, { status: 403 });
    }
  }

  const client = makeClient(host, port, ssl, username, password);

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const messages = [];

    try {
      // Recherche IMAP côté serveur : sujet, corps, expéditeur
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uids: number[] = await (client as any).search({
        or: [
          { subject: query },
          { body: query },
          { from: query },
          { to: query },
        ],
      }, { uid: true });

      // Limiter à 50 résultats max, les plus récents
      const toFetch = uids.slice(-50);

      if (toFetch.length > 0) {
        const range = toFetch.join(",");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for await (const msg of (client as any).fetch(range, {
          uid: true, flags: true, envelope: true,
        }, { uid: true }) as AsyncIterable<any>) {
          const env = msg.envelope ?? {};
          const flags = msg.flags ?? new Set();
          const isUnread = !flags.has("\\Seen");
          const isStarred = flags.has("\\Flagged");

          const threadId = env.messageId
            ? env.messageId.replace(/[<>]/g, "").replace(/[^a-zA-Z0-9@._-]/g, "_")
            : `${accountId}-${msg.uid}`;

          messages.push({
            id: `${accountId}-${msg.uid}`,
            uid: msg.uid,
            threadId,
            accountId,
            from: {
              name: env.from?.[0]?.name ?? env.from?.[0]?.address ?? "Inconnu",
              email: env.from?.[0]?.address ?? "",
            },
            to: (env.to ?? []).map((a: { name?: string; address?: string }) => ({
              name: a.name ?? a.address ?? "",
              email: a.address ?? "",
            })),
            subject: env.subject ?? "(Sans objet)",
            body: "", bodyText: "",
            date: env.date?.toISOString() ?? new Date().toISOString(),
            status: isUnread ? "unread" : "read",
            labels: ["inbox", ...(isStarred ? ["starred"] : [])],
          });
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
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur de recherche";
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
