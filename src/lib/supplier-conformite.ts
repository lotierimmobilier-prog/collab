import { prisma } from "@/lib/prisma";
import { sendMail, getMailSettings } from "@/lib/mailer";
import { getTemplate, renderTemplate } from "@/lib/mail-templates";

const BASE_URL = process.env.NEXTAUTH_URL || "https://collab.lotier-immobilier.com";
const REMIND_DAYS = 30;

export type ConfStatus = "ok" | "soon" | "expired" | "none";

export function confStatus(expiry: Date | string | null | undefined, now = new Date()): ConfStatus {
  if (!expiry) return "none";
  const d = new Date(expiry);
  if (isNaN(d.getTime())) return "none";
  const days = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= REMIND_DAYS) return "soon";
  return "ok";
}

function genToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// Jeton de l'espace fournisseur (créé si absent).
export async function ensurePortalToken(supplierId: string, existing?: string | null): Promise<string> {
  if (existing) return existing;
  const token = genToken();
  await prisma.supplier.update({ where: { id: supplierId }, data: { portalToken: token } });
  return token;
}

// Liste des justificatifs à fournir/renouveler pour un fournisseur.
export function missingDocs(s: { insuranceExpiry?: Date | string | null; urssafExpiry?: Date | string | null }): string[] {
  const out: string[] = [];
  const ins = confStatus(s.insuranceExpiry);
  const urs = confStatus(s.urssafExpiry);
  if (ins === "none" || ins === "expired" || ins === "soon")
    out.push(ins === "soon" ? "• Attestation d'assurance (décennale / RC pro) — à renouveler" : "• Attestation d'assurance (décennale / RC pro)");
  if (urs === "none" || urs === "expired" || urs === "soon")
    out.push(urs === "soon" ? "• Attestation de vigilance URSSAF — à renouveler" : "• Attestation de vigilance URSSAF");
  return out;
}

function agencyName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return (m ? m[1] : from).trim() || "Votre agence";
}

// Envoie la relance « justificatifs à jour » à un fournisseur (email + lien
// de l'espace fournisseur). Met à jour lastConfReminderAt.
export async function sendConfReminder(s: {
  id: string; name: string; email?: string | null; portalToken?: string | null;
  insuranceExpiry?: Date | string | null; urssafExpiry?: Date | string | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (!s.email) return { ok: false, error: "Pas d'email" };
  const manquants = missingDocs(s);
  if (!manquants.length) return { ok: false, error: "Rien à demander" };

  const token = await ensurePortalToken(s.id, s.portalToken);
  const cfg = await getMailSettings();
  const tpl = await getTemplate("supplier_conformite");
  const rendered = renderTemplate(tpl ?? { subject: "Vos justificatifs — {{agence_nom}}", body: "{{manquants}}\n{{lien}}" }, {
    manquants: manquants.join("\n"),
    lien: `${BASE_URL}/fournisseur/${token}`,
    agence_nom: agencyName(cfg.from),
  });

  try {
    await sendMail({ to: s.email, subject: rendered.subject, html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1C1A17">${rendered.body.replace(/\n/g, "<br/>")}</div>` });
    await prisma.supplier.update({ where: { id: s.id }, data: { lastConfReminderAt: new Date() } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Passe quotidienne (throttlée) : relance les fournisseurs dont l'assurance ou
// l'URSSAF est manquante / proche de l'expiration / expirée.
export async function runDueSupplierConfReminders(): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const marker = await prisma.setting.findUnique({ where: { key: "supplier_conf_reminder_last_run" } }).catch(() => null);
    if (marker?.value === today) return;
    await prisma.setting.upsert({ where: { key: "supplier_conf_reminder_last_run" }, update: { value: today }, create: { key: "supplier_conf_reminder_last_run", value: today } });

    const now = new Date();
    const reMin = new Date(now.getTime() - 25 * 86_400_000);
    const horizon = new Date(now.getTime() + REMIND_DAYS * 86_400_000);

    // Candidats : email présent, et au moins un justificatif manquant/à renouveler.
    const suppliers = await prisma.supplier.findMany({
      where: {
        active: true,
        email: { not: null },
        OR: [
          { insuranceExpiry: null }, { insuranceExpiry: { lte: horizon } },
          { urssafExpiry: null }, { urssafExpiry: { lte: horizon } },
        ],
        AND: [{ OR: [{ lastConfReminderAt: null }, { lastConfReminderAt: { lt: reMin } }] }],
      },
      select: { id: true, name: true, email: true, portalToken: true, insuranceExpiry: true, urssafExpiry: true },
      take: 100,
    });

    for (const s of suppliers) {
      if (!missingDocs(s).length) continue;
      await sendConfReminder(s);
    }
  } catch { /* tables absentes / SMTP non configuré → silencieux */ }
}
