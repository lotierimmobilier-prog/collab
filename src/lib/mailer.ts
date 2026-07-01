import nodemailer from "nodemailer";
import { prisma } from "./prisma";

export async function getMailSettings() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ["smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from", "notif_enabled"] } },
  });
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key] = r.value;
  return {
    host: s.smtp_host ?? "smtp.gmail.com",
    port: parseInt(s.smtp_port ?? "587"),
    user: s.smtp_user ?? "collab@lotier-immobilier.com",
    pass: s.smtp_pass ?? "",
    from: s.smtp_from ?? "Collab Lotier <collab@lotier-immobilier.com>",
    enabled: s.notif_enabled !== "false",
  };
}

export interface MailAttachment { filename: string; content: Buffer; contentType?: string }

// Combinaisons (port, secure) à tenter : le port configuré d'abord, puis les
// ports SMTP standards (465 SSL, 587 STARTTLS) en repli — utile si l'on a saisi
// un port de réception (993/143 IMAP, 995/110 POP) au lieu d'un port d'envoi.
function smtpCombos(port: number): { port: number; secure: boolean }[] {
  const list: { port: number; secure: boolean }[] = [{ port, secure: port === 465 }];
  for (const c of [{ port: 465, secure: true }, { port: 587, secure: false }]) {
    if (!list.some(x => x.port === c.port)) list.push(c);
  }
  return list;
}

export async function sendMail({ to, cc, replyTo, subject, html, attachments, transactional }: { to: string; cc?: string; replyTo?: string; subject: string; html: string; attachments?: MailAttachment[]; transactional?: boolean }): Promise<boolean> {
  const cfg = await getMailSettings();
  // Les emails « transactionnels » (code de connexion…) s'envoient même si la
  // bascule « notifications » est désactivée — il faut seulement des identifiants
  // SMTP valides (hôte + mot de passe).
  if ((!cfg.enabled && !transactional) || !cfg.pass || !cfg.host) return false;

  const message = { from: cfg.from, to, ...(cc ? { cc } : {}), ...(replyTo ? { replyTo } : {}), subject, html, ...(attachments?.length ? { attachments } : {}) };
  let lastErr: unknown = null;
  for (const { port, secure } of smtpCombos(cfg.port)) {
    try {
      // 465 = TLS implicite ; 587/25 = STARTTLS. rejectUnauthorized:false tolère
      // les certificats mutualisés ; timeouts pour éviter les blocages.
      const transporter = nodemailer.createTransport({
        host: cfg.host, port, secure,
        requireTLS: !secure && port !== 25,
        auth: { user: cfg.user, pass: cfg.pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 20000,
      });
      const info = await transporter.sendMail(message);
      // Le serveur a répondu mais peut avoir refusé le destinataire : on le
      // détecte (sinon l'envoi paraît réussi alors que rien n'est délivré).
      const accepted = (info?.accepted ?? []) as string[];
      const rejected = (info?.rejected ?? []) as string[];
      if (accepted.length === 0 && rejected.length > 0) {
        throw new Error(`Destinataire refusé par le serveur (${cfg.host}:${port}) : ${rejected.join(", ")}`);
      }
      return true;
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export function eventMailHtml({ title, start, end, location, description, attendees }: {
  title: string; start: string; end: string;
  location?: string; description?: string;
  attendees?: { name: string; email: string }[];
}) {
  const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#B8966A;padding:20px 24px">
    <h1 style="color:#fff;margin:0;font-size:20px">📅 ${title}</h1>
  </div>
  <div style="padding:24px">
    <p style="color:#374151"><strong>Début :</strong> ${fmt(start)}</p>
    <p style="color:#374151"><strong>Fin :</strong> ${fmt(end)}</p>
    ${location ? `<p style="color:#374151"><strong>Lieu :</strong> ${location}</p>` : ""}
    ${description ? `<p style="color:#374151"><strong>Description :</strong> ${description}</p>` : ""}
    ${attendees?.length ? `<p style="color:#374151"><strong>Participants :</strong> ${attendees.map(a => a.name).join(", ")}</p>` : ""}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
    <p style="color:#9ca3af;font-size:12px">Collab — Lotier Immobilier · <a href="https://collab.lotier-immobilier.com/planning">Voir l'agenda</a></p>
  </div>
</div>`;
}
