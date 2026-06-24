import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const reqBody = await req.json();
  let { smtpHost, smtpPort, smtpSsl, username, password } = reqBody;
  const { to, cc, subject, body, html, fromEmail, fromName, replyToMessageId, inReplyTo, accountId } = reqBody;

  if (accountId && (!smtpHost || !password)) {
    const dbAcc = await prisma.mailAccountConfig.findUnique({ where: { id: accountId } });
    if (dbAcc) { smtpHost = dbAcc.smtpHost; smtpPort = dbAcc.smtpPort; smtpSsl = dbAcc.smtpSsl; username = dbAcc.username; password = dbAcc.password; }
  }

  if (!smtpHost || !username || !password) {
    return NextResponse.json({ error: "Configuration SMTP manquante" }, { status: 400 });
  }
  if (!to || !subject) {
    return NextResponse.json({ error: "Destinataire et objet requis" }, { status: 400 });
  }

  const port = parseInt(String(smtpPort ?? 587), 10);
  // Port 465 = SSL direct (secure:true), port 587/25 = STARTTLS (secure:false)
  const isDirectSsl = smtpSsl === true && port === 465;
  const transport = nodemailer.createTransport({
    host: smtpHost,
    port,
    secure: isDirectSsl,
    requireTLS: !isDirectSsl && port !== 25,
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
