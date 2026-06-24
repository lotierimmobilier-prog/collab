import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { to, cc, subject, body, html, fromEmail, fromName, smtpHost, smtpPort, smtpSsl, username, password, replyToMessageId, inReplyTo } = await req.json();

  if (!smtpHost || !username || !password) {
    return NextResponse.json({ error: "Configuration SMTP manquante" }, { status: 400 });
  }
  if (!to || !subject) {
    return NextResponse.json({ error: "Destinataire et objet requis" }, { status: 400 });
  }

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort ?? 587,
    secure: smtpSsl ?? (smtpPort === 465),
    auth: { user: username, pass: password },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transport.verify();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Connexion SMTP échouée : ${msg}` }, { status: 502 });
  }

  const mailOptions: nodemailer.SendMailOptions = {
    from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
    to,
    ...(cc && { cc }),
    subject,
    text: body,
    html: html || `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${(body ?? "").replace(/\n/g, "<br/>")}</div>`,
    ...(replyToMessageId && { references: replyToMessageId }),
    ...(inReplyTo && { inReplyTo }),
  };

  try {
    const info = await transport.sendMail(mailOptions);
    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Envoi échoué : ${msg}` }, { status: 502 });
  }
}
