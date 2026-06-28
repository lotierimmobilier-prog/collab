// Emails de la formation par parrainage : affectation d'un parrain et
// validations de compétences. Best-effort, transactionnel.
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail, emailBaseUrl } from "@/lib/email-template";

const GOLD = "#B8966A";
const DARK = "#1C1A17";
const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const validEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

function btn(href: string, label: string): string {
  return `<p style="margin:4px 0 0;"><a href="${href}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:bold;font-size:14px;">${esc(label)}</a></p>`;
}
function wrap(title: string, body: string): string {
  return `<h2 style="margin:0 0 12px;color:${DARK};font-size:18px;">${esc(title)}</h2>${body}`;
}

async function userById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: { prenom: true, nom: true, email: true } }).catch(() => null);
}

// Affectation d'un parrain à un filleul : on prévient les deux.
export async function notifyParrainageAssigned(filleulId: string, parrainId: string): Promise<void> {
  const [filleul, parrain] = await Promise.all([userById(filleulId), userById(parrainId)]);
  const url = `${emailBaseUrl()}/formation`;
  if (filleul?.email && validEmail(filleul.email)) {
    const c = wrap("Votre parrain de formation",
      `<p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Bonjour ${esc(filleul.prenom ?? "")},</p>
       <p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;"><strong>${esc(`${parrain?.prenom ?? ""} ${parrain?.nom ?? ""}`.trim() || "Un parrain")}</strong> vous accompagne désormais dans votre <strong>formation par parrainage</strong>. Vous pouvez consulter votre parcours, suivre vos compétences et répondre aux QCM dans votre espace.</p>
       ${btn(url, "Accéder à ma formation")}`);
    await sendMail({ to: filleul.email, subject: "Un parrain vous accompagne dans votre formation", html: renderBrandedEmail({ subject: "Votre parrain de formation", contentHtml: c }), transactional: true }).catch(() => {});
  }
  if (parrain?.email && validEmail(parrain.email)) {
    const c = wrap("Vous parrainez un nouveau collaborateur",
      `<p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Bonjour ${esc(parrain.prenom ?? "")},</p>
       <p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Vous êtes désormais le parrain de <strong>${esc(`${filleul?.prenom ?? ""} ${filleul?.nom ?? ""}`.trim() || "un filleul")}</strong>. Accompagnez-le dans sa montée en compétences et validez son parcours au fil de l'eau.</p>
       ${btn(url, "Suivre mon filleul")}`);
    await sendMail({ to: parrain.email, subject: "Vous accompagnez un nouveau filleul", html: renderBrandedEmail({ subject: "Nouveau filleul", contentHtml: c }), transactional: true }).catch(() => {});
  }
}

// Validation d'une compétence. `by` = côté qui vient de valider. Une seule
// validation (filleul OU parrain) suffit désormais à acquérir la compétence.
export async function notifyCompetenceValidated(filleulId: string, competenceId: string, by: "parrain" | "filleul"): Promise<void> {
  const comp = await prisma.trainingCompetence.findUnique({ where: { id: competenceId }, select: { title: true } }).catch(() => null);
  const title = comp?.title ? `« ${comp.title} »` : "une compétence";
  const url = `${emailBaseUrl()}/formation`;

  const { getExtra } = await import("@/lib/user-extras");
  const parrainId = (await getExtra(filleulId))?.parrainId ?? null;
  const [filleul, parrain] = await Promise.all([userById(filleulId), parrainId ? userById(parrainId) : Promise.resolve(null)]);

  if (by === "parrain" && filleul?.email && validEmail(filleul.email)) {
    // Le parrain a validé : la compétence est acquise, on félicite le filleul.
    const c = wrap("Compétence validée 🎉",
      `<p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Bravo ${esc(filleul.prenom ?? "")} ! Votre parrain a validé la compétence ${esc(title)} : elle est désormais <strong>acquise</strong>.</p>
       ${btn(url, "Voir mon parcours")}`);
    await sendMail({ to: filleul.email, subject: `Compétence validée : ${comp?.title ?? "formation"}`, html: renderBrandedEmail({ subject: "Compétence validée", contentHtml: c }), transactional: true }).catch(() => {});
  }
  if (by === "filleul" && parrain?.email && validEmail(parrain.email)) {
    // Le filleul a validé : on informe le parrain (suivi).
    const c = wrap("Votre filleul a validé une compétence",
      `<p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Bonjour ${esc(parrain.prenom ?? "")},</p>
       <p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;"><strong>${esc(`${filleul?.prenom ?? ""} ${filleul?.nom ?? ""}`.trim() || "Votre filleul")}</strong> a validé la compétence ${esc(title)}. Vous pouvez la consulter dans le suivi.</p>
       ${btn(url, "Suivre mon filleul")}`);
    await sendMail({ to: parrain.email, subject: "Votre filleul a validé une compétence", html: renderBrandedEmail({ subject: "Avancement formation", contentHtml: c }), transactional: true }).catch(() => {});
  }
}
