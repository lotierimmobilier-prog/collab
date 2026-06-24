import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";

export async function POST(req: NextRequest) {
  const { host, port, ssl, username, password, accountId, limit = 50 } = await req.json();

  if (!host || !username || !password) {
    return NextResponse.json({ ok: false, error: "Paramètres incomplets" }, { status: 400 });
  }

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
      const mailbox = client.mailbox;
      const total = mailbox && typeof mailbox === "object" && "exists" in mailbox ? (mailbox as { exists: number }).exists : 50;
      const from = Math.max(1, total - limit + 1);
      const range = `${from}:*`;

      for await (const msg of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
        source: false,
      })) {
        const env = msg.envelope;
        const isUnread = !msg.flags?.has("\\Seen");
        const isStarred = !!msg.flags?.has("\\Flagged");

        const labels = ["inbox"];
        if (isStarred) labels.push("starred");

        // Récupération du corps texte
        let bodyText = "";
        let bodyHtml = "";
        try {
          const fullMsg = await client.fetchOne(String(msg.seq), { bodyParts: ["TEXT", "1", "1.1"] });
          const parts = fullMsg?.bodyParts;
          if (parts) {
            const text = parts.get("TEXT") ?? parts.get("1") ?? parts.get("1.1");
            if (text) {
              bodyText = Buffer.from(text).toString("utf-8").slice(0, 2000);
              bodyHtml = `<p>${bodyText.replace(/\n/g, "<br/>")}</p>`;
            }
          }
        } catch {
          bodyText = "(corps non disponible)";
          bodyHtml = "<p>(corps non disponible)</p>";
        }

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
      messages: messages.reverse(), // plus récents en premier
      count: messages.length,
      message: `${messages.length} message(s) synchronisé(s) depuis INBOX`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur de synchronisation";
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
