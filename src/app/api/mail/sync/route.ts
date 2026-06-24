import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require("imapflow");

export async function POST(req: NextRequest) {
  const { host, port, ssl, username, password, accountId, limit = 50 } = await req.json();

  if (!host || !username || !password) {
    return NextResponse.json({ ok: false, error: "Paramètres incomplets" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = new ImapFlow({
    host,
    port: parseInt(port),
    secure: ssl,
    auth: { user: username, pass: password },
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 5000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const messages = [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mailbox = client.mailbox as any;
      const total = mailbox?.exists ?? 50;
      const from = Math.max(1, total - limit + 1);
      const range = `${from}:*`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for await (const msg of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
        source: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as AsyncIterable<any>) {
        const env = msg.envelope ?? {};
        const flags = msg.flags ?? new Set();
        const isUnread = !flags.has("\\Seen");
        const isStarred = flags.has("\\Flagged");

        const labels = ["inbox"];
        if (isStarred) labels.push("starred");

        let bodyText = msg.snippet ?? "";
        let bodyHtml = `<p>${bodyText}</p>`;

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fullMsg = await client.fetchOne(String(msg.seq), { bodyParts: ["TEXT", "1"] }) as any;
          const parts = fullMsg?.bodyParts;
          if (parts) {
            const raw = parts.get("TEXT") ?? parts.get("1");
            if (raw) {
              bodyText = Buffer.from(raw).toString("utf-8").slice(0, 2000);
              bodyHtml = `<p>${bodyText.replace(/\n/g, "<br/>")}</p>`;
            }
          }
        } catch { /* corps non disponible */ }

        const threadId = env.messageId
          ? env.messageId.replace(/[<>]/g, "").replace(/[^a-zA-Z0-9@._-]/g, "_")
          : `${accountId}-${msg.uid}`;

        messages.push({
          id: `${accountId}-${msg.uid}`,
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
          body: bodyHtml,
          bodyText,
          date: env.date?.toISOString() ?? new Date().toISOString(),
          status: isUnread ? "unread" : "read",
          labels,
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
      message: `${messages.length} message(s) synchronisé(s) depuis INBOX`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur de synchronisation";
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
