// Notifie le locataire par email quand le statut de sa demande évolue
// (reçue → en cours → traitée). Best-effort, transactionnel.
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail, emailBaseUrl } from "@/lib/email-template";
import { tenantRequestStatus } from "@/lib/client-data";

const GOLD = "#B8966A";
const DARK = "#1C1A17";
const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// On ne notifie que les passages « visibles » pour le locataire.
const NOTIFY_STATUS: Record<string, { title: string; intro: string }> = {
  ods_cree: {
    title: "Votre demande est prise en charge",
    intro: "Bonne nouvelle : votre demande est <strong>en cours de traitement</strong>. Un ordre d'intervention a été transmis à notre prestataire.",
  },
  cloturee: {
    title: "Votre demande est traitée",
    intro: "Votre demande a été <strong>traitée et clôturée</strong>. Si quelque chose ne vous semble pas réglé, répondez simplement à cet email.",
  },
};

export async function notifyTenantRequestStatus(requestId: string): Promise<boolean> {
  try {
    const r = await prisma.assistanceRequest.findUnique({
      where: { id: requestId },
      select: { role: true, status: true, contactName: true, contactEmail: true, description: true, id: true },
    });
    if (!r || r.role !== "locataire") return false;
    const to = (r.contactEmail ?? "").trim();
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return false;
    const meta = NOTIFY_STATUS[r.status];
    if (!meta) return false; // statut non notifiable (ex. retour à "reçue")

    const st = tenantRequestStatus(r.status);
    const prenom = (r.contactName ?? "").trim().split(/\s+/)[0] ?? "";
    const ref = String(r.id).slice(-6).toUpperCase();
    const url = `${emailBaseUrl()}/espace-client`;
    const extrait = r.description ? `<p style="margin:0 0 14px;color:#6b6357;font-size:13px;line-height:1.6;background:#F7F0E6;border-radius:8px;padding:10px 12px;">« ${esc(r.description.slice(0, 200))}${r.description.length > 200 ? "…" : ""} »</p>` : "";
    const content = `
      <h2 style="margin:0 0 12px;color:${DARK};font-size:18px;">${esc(meta.title)}</h2>
      <p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">Bonjour${prenom ? ` ${esc(prenom)}` : ""},</p>
      <p style="margin:0 0 14px;color:#3f3a33;font-size:14px;line-height:1.7;">${meta.intro}</p>
      ${extrait}
      <p style="margin:0 0 16px;font-size:14px;color:#3f3a33;">Référence de la demande : <strong>${ref}</strong> — Statut : <strong style="color:${st.color}">${st.label}</strong></p>
      <p style="margin:0 0 8px;">
        <a href="${url}" style="display:inline-block;background:${GOLD};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;font-size:14px;">Suivre mes demandes</a>
      </p>`;
    return await sendMail({
      to, subject: `${meta.title} (réf. ${ref})`,
      html: renderBrandedEmail({ subject: meta.title, contentHtml: content }),
      transactional: true,
    });
  } catch { return false; }
}
