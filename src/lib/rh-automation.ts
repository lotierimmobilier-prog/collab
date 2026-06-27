import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail, getMailSettings } from "@/lib/mailer";
import { getTemplate, renderTemplate } from "@/lib/mail-templates";
import { buildDecomptePdf } from "@/lib/decompte-pdf";
import { monthLabel, type DayEntry } from "@/lib/decompte";

const BASE_URL = process.env.NEXTAUTH_URL || "https://collab.lotier-immobilier.com";
export const AGENCY_UID = "__agency__"; // propriétaire « agence » du drive partagé
const DEFAULT_ACCOUNTANT = "lola.cuypers@synec.fr";

export function agencyName(from: string): string {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return (m ? m[1] : from).trim() || "Lotier Immobilier";
}

// Jeton de téléchargement public (HMAC) — pas de colonne en base.
export function decompteToken(id: string): string {
  return crypto.createHmac("sha256", process.env.AUTH_SECRET || "collab").update(`decompte:${id}`).digest("hex").slice(0, 32);
}
export function verifyDecompteToken(id: string, t: string): boolean {
  const expected = decompteToken(id);
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(t)); } catch { return false; }
}

async function accountantEmail(): Promise<string> {
  const s = await prisma.setting.findUnique({ where: { key: "rh_accountant_email" } }).catch(() => null);
  return (s?.value || "").trim() || DEFAULT_ACCOUNTANT;
}

// ── Drive d'agence : rangement d'un fichier dans un dossier (créé au besoin) ──
async function ensureFolder(parentId: string | null, name: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = await (prisma.driveItem.findFirst as any)({ where: { userId: AGENCY_UID, parentId, kind: "folder", name } });
  if (found) return found.id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await prisma.driveItem.create({ data: { userId: AGENCY_UID, parentId, kind: "folder", name } as any, select: { id: true } });
  return created.id;
}

export async function storeAgencyFile(path: string[], name: string, mime: string, dataB64: string): Promise<string | null> {
  try {
    let parent: string | null = null;
    for (const folder of path) parent = await ensureFolder(parent, folder);
    // Remplace un fichier de même nom dans le dossier.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.driveItem.deleteMany as any)({ where: { userId: AGENCY_UID, parentId: parent, kind: "file", name } });
    const size = Math.ceil((dataB64.length * 3) / 4);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = await prisma.driveItem.create({ data: { userId: AGENCY_UID, parentId: parent, kind: "file", name, mime, size, data: dataB64 } as any, select: { id: true } });
    return item.id;
  } catch { return null; }
}

// ── Envoi du décompte signé au comptable + rangement dans le drive d'agence ──
export async function sendDecompteToAccountant(hoursId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h: any = await prisma.monthlyHours.findUnique({ where: { id: hoursId } });
    if (!h) return { ok: false, error: "Introuvable" };
    if (h.status !== "valide" || !h.agentSignedAt || !h.directionSignedAt) return { ok: false, error: "Pas encore signé des deux parties" };

    const entries: DayEntry[] = Array.isArray(h.entries) ? h.entries : [];
    const label = monthLabel(h.month);
    const pdf = await buildDecomptePdf({
      societe: h.societe, employe: h.employe, month: h.month, monthLabel: label,
      heureHebdo: h.heureHebdo, entries,
      avantageNature: h.avantageNature, acompte: h.acompte, acompteMode: h.acompteMode,
      primeMotif: h.primeMotif, primeMontant: h.primeMontant,
      agentSignatureName: h.agentSignatureName, agentSignedAt: h.agentSignedAt,
      directionSignatureName: h.directionSignatureName, directionSignedAt: h.directionSignedAt,
    });
    const b64 = Buffer.from(pdf).toString("base64");
    const year = h.month.slice(0, 4);
    const fileName = `decompte-${(h.employe || "salarie").replace(/[^\w-]+/g, "_")}-${h.month}.pdf`;

    // Rangement dans le drive d'agence : Décomptes heures / <année>.
    await storeAgencyFile(["Décomptes heures", year], fileName, "application/pdf", b64);

    const cfg = await getMailSettings();
    const to = await accountantEmail();
    const tpl = await getTemplate("hours_accountant");
    const link = `${BASE_URL}/api/public/decompte/${hoursId}?t=${decompteToken(hoursId)}`;
    const rendered = renderTemplate(tpl ?? { subject: "Décompte des heures — {{employe}} — {{mois}}", body: "{{lien}}" }, {
      employe: h.employe || "", mois: label, lien: link, agence_nom: agencyName(cfg.from),
    });

    const sent = await sendMail({
      to, subject: rendered.subject,
      html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1C1A17">${rendered.body.replace(/\n/g, "<br/>")}</div>`,
      attachments: [{ filename: fileName, content: Buffer.from(pdf), contentType: "application/pdf" }],
    });
    if (sent) await prisma.monthlyHours.update({ where: { id: hoursId }, data: { sentToAccountantAt: new Date() } });
    return { ok: sent, error: sent ? undefined : "Email non configuré" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Relance mensuelle (le 25) aux collaborateurs salariés ──
export async function runMonthlyHoursReminder(now = new Date()): Promise<void> {
  try {
    if (now.getDate() !== 25) return; // uniquement le 25
    const today = now.toISOString().slice(0, 10);
    const marker = await prisma.setting.findUnique({ where: { key: "hours_reminder_last_run" } }).catch(() => null);
    if (marker?.value === today) return;
    await prisma.setting.upsert({ where: { key: "hours_reminder_last_run" }, update: { value: today }, create: { key: "hours_reminder_last_run", value: today } });

    // Collaborateurs salariés de l'agence (statut « salarié » dans user_extras).
    const { employeeUserIds } = await import("@/lib/user-extras");
    const empIds = await employeeUserIds();
    const users = empIds.length
      ? await prisma.user.findMany({ where: { id: { in: empIds }, active: true, email: { not: "" } }, select: { email: true } })
      : [];
    const month = now.toISOString().slice(0, 7);
    const cfg = await getMailSettings();
    const tpl = await getTemplate("hours_reminder_collab");
    const rendered = renderTemplate(tpl ?? { subject: "Décompte {{mois}}", body: "{{lien}}" }, {
      mois: monthLabel(month), lien: `${BASE_URL}/rh`, agence_nom: agencyName(cfg.from),
    });
    for (const u of users) {
      if (!u.email) continue;
      await sendMail({ to: u.email, subject: rendered.subject, html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1C1A17">${rendered.body.replace(/\n/g, "<br/>")}</div>` }).catch(() => false);
    }
  } catch { /* SMTP non configuré → silencieux */ }
}
