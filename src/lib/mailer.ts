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

export async function sendMail({ to, subject, html, attachments }: { to: string; subject: string; html: string; attachments?: MailAttachment[] }): Promise<boolean> {
  const cfg = await getMailSettings();
  if (!cfg.enabled || !cfg.pass) return false;

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  await transporter.sendMail({ from: cfg.from, to, subject, html, ...(attachments?.length ? { attachments } : {}) });
  return true;
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
