// Suivi des attestations d'assurance et relances automatiques.
// Idempotent : on mémorise sur le document la dernière étape de rappel envoyée
// (reminderStage), si bien que la tâche peut tourner plusieurs fois par jour
// sans renvoyer deux fois le même rappel.
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail, emailBaseUrl } from "@/lib/email-template";
import { latestInsuranceWithTenant, setInsuranceReminderStage, type InsuranceRow } from "@/lib/client-docs";

const GOLD = "#B8966A";
const DARK = "#1C1A17";

// Étapes de rappel (sévérité croissante). On n'envoie un rappel que si l'étape
// cible dépasse celle déjà enregistrée → un seul mail par palier franchi.
export const STAGE = { NONE: 0, J30: 1, J7: 2, EXPIRED: 3 } as const;

function targetStage(days: number): number {
  if (days < 0) return STAGE.EXPIRED;
  if (days <= 7) return STAGE.J7;
  if (days <= 30) return STAGE.J30;
  return STAGE.NONE;
}

const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function reminderContent(prenom: string, stage: number, validUntil: Date): string {
  const dfr = validUntil.toLocaleDateString("fr-FR", { dateStyle: "long" });
  const url = `${emailBaseUrl()}/espace-client`;
  const hello = `<p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Bonjour${prenom ? ` ${esc(prenom)}` : ""},</p>`;
  let intro: string, urgence: string;
  if (stage === STAGE.EXPIRED) {
    intro = `<p style="margin:0 0 14px;color:#b3261e;font-size:14px;line-height:1.7;font-weight:bold;">Votre attestation d'assurance habitation est <strong>expirée</strong> depuis le ${dfr}.</p>`;
    urgence = `<p style="margin:0 0 16px;color:#3f3a33;font-size:14px;line-height:1.7;">L'assurance habitation est <strong>obligatoire</strong> pendant toute la durée de votre bail. Merci de nous transmettre <strong>au plus vite</strong> votre nouvelle attestation pour rester en règle.</p>`;
  } else if (stage === STAGE.J7) {
    intro = `<p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Votre attestation d'assurance habitation <strong>expire dans moins d'une semaine</strong>, le ${dfr}.</p>`;
    urgence = `<p style="margin:0 0 16px;color:#3f3a33;font-size:14px;line-height:1.7;">Pensez à demander votre nouvelle attestation à votre assureur et à la déposer dès réception.</p>`;
  } else {
    intro = `<p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Votre attestation d'assurance habitation arrive à échéance le <strong>${dfr}</strong>.</p>`;
    urgence = `<p style="margin:0 0 16px;color:#3f3a33;font-size:14px;line-height:1.7;">Pour anticiper, vous pouvez dès maintenant déposer votre nouvelle attestation dans votre espace locataire.</p>`;
  }
  return `
    <h2 style="margin:0 0 12px;color:${DARK};font-size:18px;">Attestation d'assurance habitation</h2>
    ${hello}${intro}${urgence}
    <p style="margin:0 0 8px;">
      <a href="${url}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;font-size:14px;">Déposer mon attestation</a>
    </p>
    <p style="margin:14px 0 0;color:#9b8e79;font-size:12.5px;line-height:1.6;">Déjà fait ? Vous pouvez ignorer ce message. Pour toute question, répondez simplement à cet email ou contactez votre agence.</p>`;
}

const SUBJECTS: Record<number, string> = {
  [STAGE.J30]: "Votre assurance habitation expire bientôt",
  [STAGE.J7]: "Votre assurance habitation expire dans quelques jours",
  [STAGE.EXPIRED]: "Votre assurance habitation a expiré — action requise",
};

export async function sendInsuranceReminder(row: InsuranceRow, stage: number, validUntil: Date): Promise<boolean> {
  const to = (row.email ?? "").trim();
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
  const subject = SUBJECTS[stage] ?? "Votre assurance habitation";
  try {
    return await sendMail({
      to, subject,
      html: renderBrandedEmail({ subject, contentHtml: reminderContent(row.prenom, stage, validUntil) }),
      transactional: true,
    });
  } catch { return false; }
}

export interface ReminderReport { checked: number; sent: number; errors: number }

// Parcourt la dernière attestation de chaque locataire et envoie le rappel du
// palier franchi (30 j / 7 j / expirée) si non encore envoyé.
export async function runInsuranceReminders(): Promise<ReminderReport> {
  const report: ReminderReport = { checked: 0, sent: 0, errors: 0 };
  const rows = await latestInsuranceWithTenant();
  for (const row of rows) {
    if (!row.validUntil) continue;
    report.checked++;
    const validUntil = new Date(row.validUntil);
    const days = Math.ceil((validUntil.getTime() - Date.now()) / 86400000);
    const target = targetStage(days);
    if (target <= row.reminderStage) continue; // palier déjà notifié (ou rien à faire)
    const ok = await sendInsuranceReminder(row, target, validUntil);
    if (ok) { await setInsuranceReminderStage(row.id, target); report.sent++; }
    else report.errors++;
  }
  return report;
}
