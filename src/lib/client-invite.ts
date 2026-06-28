// Email de bienvenue / invitation à l'espace locataire.
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail, emailBaseUrl } from "@/lib/email-template";

const GOLD = "#B8966A";
const DARK = "#1C1A17";

// Envoie l'email de bienvenue présentant l'espace locataire. Best-effort.
export async function sendTenantWelcome(tenant: { email?: string | null; prenom?: string | null }): Promise<boolean> {
  const to = (tenant.email ?? "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
  const url = `${emailBaseUrl()}/espace-client`;
  const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const content = `
    <h2 style="margin:0 0 12px;color:${DARK};font-size:18px;">Bienvenue${tenant.prenom ? ` ${esc(tenant.prenom)}` : ""} 👋</h2>
    <p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Votre agence <strong>Lotier Immobilier</strong> met à votre disposition un <strong>espace locataire</strong> personnel et sécurisé. En quelques clics, et sans rien installer :</p>
    <ul style="margin:0 0 16px;padding-left:20px;color:#3f3a33;font-size:14px;line-height:1.8;">
      <li><strong>Récupérez vos documents</strong> : bail, état des lieux, quittances, <strong>attestation de loyer</strong> (utile pour la CAF).</li>
      <li><strong>Déposez vos justificatifs</strong> en 10 s : attestation d'assurance, entretien chaudière/climatisation.</li>
      <li><strong>Communiquez rapidement</strong> avec l'agence et posez vos questions à <strong>Auguste</strong>, votre assistant (solde, rendez-vous, signaler un problème).</li>
    </ul>
    <p style="margin:0 0 18px;color:#3f3a33;font-size:14px;line-height:1.7;">Un vrai <strong>gain de temps</strong> pour vous comme pour nous : plus besoin d'échanger des courriers ou de chercher un document.</p>
    <p style="margin:0 0 8px;">
      <a href="${url}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;font-size:14px;">Accéder à mon espace locataire</a>
    </p>
    <p style="margin:14px 0 0;color:#9b8e79;font-size:12.5px;line-height:1.6;">Connexion simple et sécurisée : saisissez <strong>cette adresse email</strong> (${esc(to)}) sur l'espace, vous recevrez un <strong>code à usage unique</strong>. Aucun mot de passe à retenir.</p>`;
  try {
    return await sendMail({ to, subject: "Votre espace locataire Lotier Immobilier", html: renderBrandedEmail({ subject: "Votre espace locataire", contentHtml: content }), transactional: true });
  } catch { return false; }
}
