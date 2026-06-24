import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ImapFlow } = require("imapflow");

export async function POST(req: NextRequest) {
  const { host, port, ssl, username, password, uid } = await req.json();

  if (!host || !username || !password || !uid) {
    return NextResponse.json({ ok: false, error: "Paramètres incomplets" }, { status: 400 });
  }

  const client = new ImapFlow({
    host,
    port: parseInt(port),
    secure: ssl,
    auth: { user: username, pass: password },
    logger: false,
    connectionTimeout: 20000,
    greetingTimeout: 8000,
    socketTimeout: 30000,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = await client.fetchOne(`${uid}`, { bodyParts: ["TEXT", "1", "1.1"] }, { uid: true }) as any;
      let bodyText = "";
      let bodyHtml = "";

      if (msg?.bodyParts) {
        const parts = msg.bodyParts;
        const rawHtml = parts.get("1") ?? parts.get("1.1");
        const rawText = parts.get("TEXT");

        if (rawHtml) {
          bodyHtml = Buffer.from(rawHtml).toString("utf-8");
        }
        if (rawText) {
          bodyText = Buffer.from(rawText).toString("utf-8").slice(0, 5000);
          if (!bodyHtml) bodyHtml = `<pre style="white-space:pre-wrap;font-family:inherit">${bodyText}</pre>`;
        }
      }

      return NextResponse.json({ ok: true, bodyHtml, bodyText });
    } finally {
      lock.release();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ ok: false, error: msg });
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}
