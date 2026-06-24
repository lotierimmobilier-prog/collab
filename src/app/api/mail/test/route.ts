import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";

export async function POST(req: NextRequest) {
  const { host, port, ssl, username, password, protocol } = await req.json();

  if (!host || !username || !password) {
    return NextResponse.json({ ok: false, error: "Paramètres incomplets" }, { status: 400 });
  }

  if (protocol === "pop3") {
    // POP3 test — connexion basique TCP
    return NextResponse.json({
      ok: true,
      message: "Configuration POP3 enregistrée (test de connexion disponible uniquement pour IMAP)",
      protocol: "pop3",
    });
  }

  const client = new ImapFlow({
    host,
    port: parseInt(port),
    secure: ssl,
    auth: { user: username, pass: password },
    logger: false,
    connectionTimeout: 10000,
    greetingTimeout: 5000,
  });

  try {
    await client.connect();
    const status = await client.status("INBOX", { messages: true, unseen: true });
    await client.logout();
    return NextResponse.json({
      ok: true,
      message: `Connexion réussie — INBOX : ${status.messages} message(s), ${status.unseen} non lu(s)`,
      inbox: { messages: status.messages, unseen: status.unseen },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erreur de connexion";
    let hint = "";
    if (msg.includes("AUTHENTICATIONFAILED") || msg.includes("Invalid credentials")) {
      hint = " → Vérifiez l'identifiant et le mot de passe. Pour Gmail, utilisez un mot de passe d'application.";
    } else if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND")) {
      hint = " → Vérifiez l'adresse du serveur et le port.";
    } else if (msg.includes("certificate") || msg.includes("SSL")) {
      hint = " → Problème SSL — essayez de désactiver SSL ou changez le port.";
    }
    return NextResponse.json({ ok: false, error: msg + hint }, { status: 200 });
  }
}
