// Emails de notification (message interne, tâche attribuée) envoyés à l'agent
// via le compte SMTP de notifications. Aux couleurs de Lotier Immobilier.
// IMPORTANT : ne PAS utiliser pour les mails reçus dans la messagerie collab
// (ceux-ci ne déclenchent qu'une notification interne, pas d'email).
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail, emailBaseUrl } from "@/lib/email-template";

const GOLD = "#B8966A";
const DARK = "#1C1A17";

interface NotifyOpts {
  to: string;
  subject: string;
  heading: string;
  message: string;        // texte (sera échappé)
  ctaLabel: string;
  ctaPath: string;        // chemin interne (ex: /taches)
}

// Envoi best-effort : n'échoue jamais l'appelant (notification accessoire).
// Les raisons d'échec sont journalisées (logs serveur) pour faciliter le
// diagnostic — ex. « pourquoi tel agent n'a pas reçu l'email ».
export async function sendNotificationEmail({ to, subject, heading, message, ctaLabel, ctaPath }: NotifyOpts): Promise<void> {
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    console.warn(`[notify-mail] destinataire invalide ou absent : "${to}" (sujet : ${subject})`);
    return;
  }
  const url = emailBaseUrl() + (ctaPath.startsWith("/") ? ctaPath : `/${ctaPath}`);
  const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const content = `
    <h2 style="margin:0 0 12px;color:${DARK};font-size:18px;">${esc(heading)}</h2>
    <p style="margin:0 0 18px;color:#3f3a33;font-size:14px;line-height:1.7;">${esc(message).replace(/\n/g, "<br/>")}</p>
    <p style="margin:0 0 4px;">
      <a href="${url}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:bold;font-size:14px;">${esc(ctaLabel)}</a>
    </p>
    <p style="margin:14px 0 0;color:#9b8e79;font-size:11px;">Vous recevez cet email car une activité vous concerne sur Collab — Lotier Immobilier.</p>`;
  try {
    const ok = await sendMail({ to, subject, html: renderBrandedEmail({ subject, contentHtml: content, preheader: message }) });
    if (!ok) console.warn(`[notify-mail] non envoyé à ${to} : compte SMTP de notifications désactivé ou non configuré (Administration → Configuration SMTP).`);
  } catch (e) {
    console.warn(`[notify-mail] échec d'envoi à ${to} :`, e instanceof Error ? e.message : String(e));
  }
}

// Récupère l'email d'un utilisateur (best-effort).
export async function userEmail(userId: string): Promise<{ email: string; prenom: string | null } | null> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, prenom: true, active: true } });
    if (!u || !u.active || !u.email) return null;
    return { email: u.email, prenom: u.prenom };
  } catch { return null; }
}
