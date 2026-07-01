import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import { resolveAccountOwner } from "@/lib/mailOwner";
import { renderBrandedEmail, textToHtml, emailBaseUrl } from "@/lib/email-template";
import { isSuperAdminEmail } from "@/lib/superadmin";

// Noms courants du dossier « Envoyés » selon les serveurs (Outlook, Gmail, OVH…)
const SENT_FOLDERS = ["Sent", "Sent Messages", "Sent Items", "SENT", "Éléments envoyés", "Envoyés", "[Gmail]/Messages envoyés", "[Gmail]/Sent Mail"];

interface ImapCfg { host: string; port: number; ssl: boolean; username: string; password: string }

// Dépose une copie du mail envoyé dans le dossier « Envoyés » IMAP, pour qu'elle
// apparaisse aussi dans les autres clients de l'utilisateur (Outlook, Gmail…).
// Best-effort : chargée dynamiquement + bornée dans le temps pour ne JAMAIS
// pouvoir affecter l'envoi SMTP (déjà réussi).
async function appendToSent(cfg: ImapCfg, raw: Buffer) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ImapFlow: any = (await import("imapflow")).ImapFlow;
  const client = new ImapFlow({ host: cfg.host, port: cfg.port, secure: cfg.ssl, auth: { user: cfg.username, pass: cfg.password }, logger: false, tls: { rejectUnauthorized: false }, connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 20000 });
  await client.connect();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const boxes: any[] = await client.list();
    const found = boxes.find(b => b.specialUse === "\\Sent") || boxes.find(b => SENT_FOLDERS.includes(b.path)) || null;
    await client.append(found?.path || "Sent", raw, ["\\Seen"]);
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const reqBody = await req.json();
  let { smtpHost, smtpPort, smtpSsl, username, password } = reqBody;
  const { to, cc, subject, body, html, fromEmail, fromName, replyToMessageId, inReplyTo, accountId, attachments } = reqBody;
  let imapCfg: ImapCfg | null = null;

  if (accountId) {
    const dbAcc = await prisma.mailAccountConfig.findUnique({ where: { id: accountId } });
    if (dbAcc) {
      // Identifiants IMAP pour déposer une copie dans « Envoyés ».
      imapCfg = { host: dbAcc.host, port: dbAcc.port, ssl: dbAcc.ssl, username: dbAcc.username, password: dbAcc.password };
      // Cloisonnement : on ne peut envoyer que depuis une boîte qui nous est
      // partagée (ou la sienne / super admin).
      const uid = session.user.id;
      const allowed = dbAcc.createdBy === uid
        || (dbAcc.sharedUserIds || []).includes(uid)
        || session.user.superAdmin === true
        || isSuperAdminEmail(session.user.email);
      if (!allowed) return NextResponse.json({ error: "Vous n'avez pas accès à cette boîte d'envoi." }, { status: 403 });
      if (!smtpHost || !password) { smtpHost = dbAcc.smtpHost; smtpPort = dbAcc.smtpPort; smtpSsl = dbAcc.smtpSsl; username = dbAcc.username; password = dbAcc.password; }
    }
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
    // Timeouts : un serveur SMTP lent échoue vite avec une erreur claire
    // (au lieu de bloquer la requête jusqu'à son abandon → « Erreur réseau »).
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
  });

  try {
    await transport.verify();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Connexion SMTP échouée : ${msg}` }, { status: 502 });
  }

  // Mise en page Lotier Immobilier + lien « voir la version en ligne ».
  // Le contenu rédigé (corps + signature) devient le contenu interne de la charte.
  const innerHtml = (typeof html === "string" && html.trim()) ? html : textToHtml(body ?? "");
  const viewToken = randomUUID();
  const viewUrl = `${emailBaseUrl()}/mail-view/${viewToken}`;
  const brandedHtml = renderBrandedEmail({
    subject,
    contentHtml: innerHtml,
    viewUrl,
    senderName: fromName || undefined,
    preheader: body,
  });

  const mailOptions: nodemailer.SendMailOptions = {
    from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
    to,
    ...(cc && { cc }),
    subject,
    text: body,
    html: brandedHtml,
    ...(replyToMessageId && { references: replyToMessageId }),
    ...(inReplyTo && { inReplyTo }),
  };

  // Pièces jointes « réelles » (≤ 10 Mo). Les fichiers volumineux sont déjà
  // insérés dans le corps sous forme de lien (cf. /api/mail/upload).
  if (Array.isArray(attachments) && attachments.length) {
    mailOptions.attachments = attachments
      .filter((a: { filename?: string; content?: string }) => a?.content && a?.filename)
      .map((a: { filename: string; content: string; mime?: string }) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
        contentType: a.mime || undefined,
      }));
  }

  try {
    const info = await transport.sendMail(mailOptions);

    // Dépose une copie dans le dossier « Envoyés » IMAP (visible dans Outlook,
    // Gmail…). En tâche de fond, best-effort : n'affecte jamais l'envoi.
    if (imapCfg) {
      const cfg = imapCfg;
      after(async () => {
        try {
          const MailComposer = (await import("nodemailer/lib/mail-composer")).default;
          const raw: Buffer = await new Promise((resolve, reject) => {
            new MailComposer(mailOptions).compile().build((err: Error | null, msg: Buffer) => err ? reject(err) : resolve(msg));
          });
          await appendToSent(cfg, raw);
        } catch { /* silencieux : la copie « Envoyés » est optionnelle */ }
      });
    }

    // Copie publique (lien « voir la version en ligne »).
    await prisma.$executeRawUnsafe(
      `INSERT INTO mail_public_views (token, subject, html) VALUES ($1, $2, $3) ON CONFLICT (token) DO NOTHING`,
      viewToken, String(subject).slice(0, 500), brandedHtml,
    ).catch(() => {});

    // Sauvegarder le mail envoyé en base pour l'historique Auguste.
    // Rattaché à l'agent de la boîte (cloisonnement), sinon à l'expéditeur.
    const toStr = Array.isArray(to) ? to.join(", ") : String(to);
    const sentAccountId = accountId ?? "local";
    const owner = (accountId ? await resolveAccountOwner(accountId) : null) ?? session.user.id;
    await prisma.emailMessage.create({
      data: {
        uid:        `sent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        accountId:  sentAccountId,
        folder:     "SENT",
        threadId:   inReplyTo ?? `thread-sent-${Date.now()}`,
        fromEmail:  fromEmail ?? username,
        fromName:   fromName  ?? username,
        toEmail:    toStr,
        subject:    subject,
        bodyText:   body ?? "",
        bodyHtml:   html ?? undefined,
        date:       new Date(),
        labels:     ["sent"],
        read:       true,
        ownerId:    owner,
      },
    }).catch(() => {}); // silencieux si erreur (ex: table manquante)

    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Envoi échoué : ${msg}` }, { status: 502 });
  }
}
