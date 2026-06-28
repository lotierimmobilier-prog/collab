// Relances de formation : rappel hebdomadaire aux parrains ayant des filleuls
// en retard. Idempotent via formation_nudges (1 rappel / parrain / 7 jours).
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail, emailBaseUrl } from "@/lib/email-template";
import { computeOverview } from "@/lib/formation-overview";

const GOLD = "#B8966A";
const DARK = "#1C1A17";
const NUDGE_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface FormationReminderReport { parrains: number; sent: number }

export async function runFormationReminders(): Promise<FormationReminderReport> {
  const report: FormationReminderReport = { parrains: 0, sent: 0 };
  // Vue admin = tous les filleuls. On regroupe les retards par parrain.
  const ov = await computeOverview("__system__", true).catch(() => null);
  if (!ov) return report;

  const lateByParrain = new Map<string, { prenom: string; nom: string }[]>();
  for (const f of ov.filleuls) {
    if (!f.parrain) continue;
    if (f.status !== "en_retard" && f.status !== "jamais") continue;
    const arr = lateByParrain.get(f.parrain.id) ?? [];
    arr.push({ prenom: f.prenom, nom: f.nom });
    lateByParrain.set(f.parrain.id, arr);
  }
  if (!lateByParrain.size) return report;

  // Dernier rappel par parrain (anti-spam).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nudges: any[] = await prisma.$queryRawUnsafe(`SELECT "parrainId", "lastAt" FROM formation_nudges`).catch(() => []);
  const lastByParrain = new Map<string, number>();
  for (const n of nudges) lastByParrain.set(n.parrainId, new Date(n.lastAt).getTime());

  const url = `${emailBaseUrl()}/formation`;
  for (const [parrainId, filleuls] of lateByParrain) {
    report.parrains++;
    const last = lastByParrain.get(parrainId) ?? 0;
    if (Date.now() - last < NUDGE_EVERY_MS) continue;
    const parrain = await prisma.user.findUnique({ where: { id: parrainId }, select: { prenom: true, email: true } }).catch(() => null);
    const to = (parrain?.email ?? "").trim();
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) continue;

    const items = filleuls.map(f => `<li style="margin-bottom:4px;">${esc(`${f.prenom} ${f.nom}`.trim())}</li>`).join("");
    const content = `
      <h2 style="margin:0 0 12px;color:${DARK};font-size:18px;">Vos filleuls à relancer</h2>
      <p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Bonjour ${esc(parrain?.prenom ?? "")},</p>
      <p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">${filleuls.length === 1 ? "Un de vos filleuls n'a pas progressé" : `${filleuls.length} de vos filleuls n'ont pas progressé`} depuis un moment. Un petit point avec ${filleuls.length === 1 ? "lui" : "eux"} relancerait la dynamique :</p>
      <ul style="margin:0 0 16px;padding-left:20px;color:#3f3a33;font-size:14px;line-height:1.7;">${items}</ul>
      <p style="margin:4px 0 0;"><a href="${url}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:bold;font-size:14px;">Ouvrir le suivi de formation</a></p>`;
    const ok = await sendMail({ to, subject: "Vos filleuls à relancer en formation", html: renderBrandedEmail({ subject: "Filleuls à relancer", contentHtml: content }), transactional: true }).catch(() => false);
    if (ok) {
      report.sent++;
      await prisma.$executeRawUnsafe(
        `INSERT INTO formation_nudges ("parrainId", "lastAt") VALUES ($1, now())
           ON CONFLICT ("parrainId") DO UPDATE SET "lastAt" = now()`, parrainId,
      ).catch(() => {});
    }
  }
  return report;
}
