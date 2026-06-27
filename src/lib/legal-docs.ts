import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

// ── Types de documents administratifs/légaux ───────────────────────
export const DOC_KINDS = [
  { value: "carte_pro",      label: "Carte professionnelle",        icon: "🪪", hasExpiry: true,  hasNumber: true },
  { value: "assurance_pro",  label: "Assurance pro (RCP / garantie)", icon: "🛡", hasExpiry: true,  hasNumber: true },
  { value: "alur",           label: "Formation ALUR",               icon: "🎓", hasExpiry: true,  hasHours: true },
  { value: "piece_identite", label: "Pièce d'identité",             icon: "🪪", hasExpiry: true,  hasNumber: true },
  { value: "rib",            label: "RIB",                          icon: "🏦", hasExpiry: false },
  { value: "autre",          label: "Autre document",               icon: "📄", hasExpiry: false },
] as const;

export type DocStatus = "ok" | "soon" | "expired" | "none";

export const REMIND_DAYS = 30;

// Statut d'un document selon sa date d'expiration.
export function docStatus(expiresAt: Date | string | null | undefined, now = new Date()): DocStatus {
  if (!expiresAt) return "none";
  const exp = new Date(expiresAt);
  if (isNaN(exp.getTime())) return "none";
  const days = Math.floor((exp.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= REMIND_DAYS) return "soon";
  return "ok";
}

export function kindLabel(kind: string): string {
  return DOC_KINDS.find(k => k.value === kind)?.label ?? kind;
}

// ── Rappels d'expiration (J-30), throttlés à une passe par jour ─────
// Appelé en « fire-and-forget » depuis l'endpoint des pastilles : la
// première sollicitation de la journée déclenche l'envoi des emails.
export async function runDueLegalReminders(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const marker = await prisma.setting.findUnique({ where: { key: "legal_reminder_last_run" } }).catch(() => null);
    if (marker?.value === today) return; // déjà passé aujourd'hui
    // On pose le marqueur tout de suite pour éviter les passes concurrentes.
    await prisma.setting.upsert({ where: { key: "legal_reminder_last_run" }, update: { value: today }, create: { key: "legal_reminder_last_run", value: today } });

    const now = new Date();
    const horizon = new Date(now.getTime() + REMIND_DAYS * 86_400_000);
    const reMin = new Date(now.getTime() - 25 * 86_400_000); // pas de relance avant 25 j

    const due = await prisma.personalDocument.findMany({
      where: {
        expiresAt: { not: null, lte: horizon },
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: reMin } }],
      },
      select: { id: true, userId: true, kind: true, label: true, expiresAt: true },
    });
    if (!due.length) return;

    const userIds = [...new Set(due.map(d => d.userId))];
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, prenom: true } });
    const byId = new Map(users.map(u => [u.id, u]));

    for (const d of due) {
      const u = byId.get(d.userId);
      if (!u?.email) continue;
      const exp = d.expiresAt ? new Date(d.expiresAt) : null;
      const expired = exp ? exp.getTime() < now.getTime() : false;
      const dateStr = exp ? exp.toLocaleDateString("fr-FR") : "";
      const name = kindLabel(d.kind) + (d.label ? ` — ${d.label}` : "");
      try {
        await sendMail({
          to: u.email,
          subject: expired ? `⚠ Document expiré : ${kindLabel(d.kind)}` : `Rappel : ${kindLabel(d.kind)} expire bientôt`,
          html: `<div style="font-family:Arial,sans-serif;max-width:520px;padding:8px">
            <p>Bonjour ${u.prenom ?? ""},</p>
            <p>Votre document <strong>${name}</strong> ${expired ? `<span style="color:#dc2626">a expiré le ${dateStr}</span>` : `arrive à expiration le <strong>${dateStr}</strong>`}.</p>
            <p>Merci de le renouveler et de mettre à jour votre espace personnel :</p>
            <p><a href="https://collab.lotier-immobilier.com/mon-espace" style="color:#B8966A">Mon espace → Documents administratifs</a></p>
            <p style="color:#9ca3af;font-size:12px">Collab — Lotier Immobilier</p>
          </div>`,
        });
        await prisma.personalDocument.update({ where: { id: d.id }, data: { lastReminderAt: now } });
      } catch { /* échec d'envoi → on réessaiera demain */ }
    }
  } catch { /* tables absentes / SMTP non configuré → silencieux */ }
}
