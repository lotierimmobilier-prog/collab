import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail, emailBaseUrl } from "@/lib/email-template";

const TOKEN_TTL_DAYS = 7;

// Crée un jeton à usage unique pour la création du mot de passe.
export async function createPasswordSetupToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = (prisma as any).passwordSetupToken;
  // Un seul lien actif à la fois : on invalide les précédents jetons inutilisés.
  await t.deleteMany({ where: { userId, usedAt: null } }).catch(() => {});
  await t.create({ data: { userId, token, expiresAt } });
  return token;
}

function esc(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Envoie l'email de bienvenue avec le lien de création de mot de passe.
// Best-effort : renvoie false si l'envoi échoue (ne bloque pas la création).
export async function sendWelcomeEmail(user: { id: string; prenom: string; email: string }): Promise<boolean> {
  let token: string;
  try { token = await createPasswordSetupToken(user.id); } catch { return false; }

  const url = `${emailBaseUrl()}/definir-mot-de-passe?token=${token}`;
  const prenom = esc(user.prenom || "");

  const contentHtml = `
    <h2 style="margin:0 0 14px;color:#1C1A17;font-size:20px;">Bienvenue${prenom ? ` ${prenom}` : ""} 👋</h2>
    <p style="margin:0 0 14px;">Votre accès à <strong>Collab</strong>, la plateforme interne de <strong>Lotier Immobilier</strong>, vient d'être ouvert.</p>
    <p style="margin:0 0 18px;">Pour l'activer, il vous suffit de <strong>créer votre mot de passe personnel</strong> en cliquant sur le bouton ci-dessous :</p>
    <p style="text-align:center;margin:0 0 22px;">
      <a href="${url}" style="display:inline-block;background:#B8966A;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px;font-size:15px;">Créer mon mot de passe</a>
    </p>
    <p style="margin:0 0 18px;font-size:12px;color:#9b8e79;">Ce lien est valable ${TOKEN_TTL_DAYS} jours. S'il a expiré, demandez à votre administrateur de vous en renvoyer un.</p>

    <div style="border-top:1px solid #E6E1D9;margin:22px 0;"></div>

    <p style="margin:0 0 10px;"><strong>Collab, qu'est-ce que c'est ?</strong></p>
    <p style="margin:0 0 10px;">Votre espace de travail tout-en-un pour le quotidien de l'agence :</p>
    <ul style="margin:0 0 16px;padding-left:20px;line-height:1.8;">
      <li>📧 <strong>Messagerie</strong> et 💬 messages internes entre collègues</li>
      <li>✓ <strong>Tâches</strong> et 📅 <strong>planning</strong> partagés</li>
      <li>🏠 <strong>Gestion locative</strong>, ordres de service et espace client</li>
      <li>🗂️ <strong>Drive</strong> documentaire, annuaire et procédures</li>
      <li>🤖 <strong>Assistants IA</strong> spécialisés (dont moi !) pour vous épauler</li>
    </ul>
    <p style="margin:0 0 6px;">Vous découvrirez le reste en vous connectant. Si vous avez la moindre question, votre administrateur est là pour vous aider.</p>

    <p style="margin:22px 0 0;">Au plaisir de vous accompagner,<br/>
      <strong style="color:#1C1A17;">Auguste de La Pierre</strong><br/>
      <span style="color:#9b8e79;">Assistant IA de Lotier Immobilier</span>
    </p>`;

  const html = renderBrandedEmail({
    subject: "Bienvenue sur Collab — activez votre accès",
    preheader: "Créez votre mot de passe pour activer votre accès à Collab.",
    senderName: "Auguste de La Pierre — Assistant IA",
    contentHtml,
  });

  try {
    return await sendMail({
      to: user.email,
      subject: "Bienvenue sur Collab — activez votre accès",
      html,
      transactional: true, // s'envoie même si les notifications sont désactivées
    });
  } catch {
    return false;
  }
}
