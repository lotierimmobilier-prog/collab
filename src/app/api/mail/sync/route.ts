import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require("imapflow");

function makeClient(host: string, port: string, ssl: boolean, username: string, password: string) {
  return new ImapFlow({
    host,
    port: parseInt(port),
    secure: ssl,
    auth: { user: username, pass: password },
    logger: false,
    connectionTimeout: 20000,
    greetingTimeout: 8000,
    socketTimeout: 30000,
  });
}

export async function POST(req: NextRequest) {
  const { host, port, ssl, username, password, accountId, limit = 20 } = await req.json();

  if (!host || !username || !password) {
    return NextResponse.json({ ok: false, error: "Paramètres incomplets" }, { status: 400 });
  }

  const client = makeClient(host, port, ssl, username, password);

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const messages = [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mailbox = client.mailbox as any;
      const total = mailbox?.exists ?? 0;
      const fetchLimit = Math.min(limit, 20); // max 20 par sync
      const from = Math.max(1, total - fetchLimit + 1);
      const range = total > 0 ? `${from}:*` : "1:1";

      // Fetch enveloppe + flags seulement (pas de corps = rapide)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const msg of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as AsyncIterable<any>) {
        const env = msg.envelope ?? {};
        const flags = msg.flags ?? new Set();
        const isUnread = !flags.has("\\Seen");
        const isStarred = flags.has("\\Flagged");

        const labels = ["inbox"];
        if (isStarred) labels.push("starred");

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
          body: "", // chargé à la demande via /api/mail/body
          bodyText: "",
          date: env.date?.toISOString() ?? new Date().toISOString(),
          status: isUnread ? "unread" : "read",
          labels,
          total, // nb total messages dans INBOX
        });
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return NextResponse.json({
      ok: true,
      messages: messages.reverse(),
      count: messages.length,
      message: `${messages.length} message(s) chargé(s) (${messages[0]?.total ?? 0} au total)`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur de synchronisation";
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
