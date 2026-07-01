import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta, fmtEuro } from "@/lib/comptabilite";
import { sendMail, MailAttachment } from "@/lib/mailer";
import { renderBrandedEmail, textToHtml } from "@/lib/email-template";
import { SUPER_ADMIN_EMAIL } from "@/lib/superadmin";

export const maxDuration = 60;

// POST — envoie une ou plusieurs pointes de trésorerie (PDF joints) via collab@,
// avec un courrier d'accompagnement, à un utilisateur ou à une adresse email.
// body : { pointeIds: string[], recipientUserId?, recipientEmail?, subject?, message }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canAccessCompta((session.user as { roleId?: string }).roleId)) return NextResponse.json({ error: "Réservé à la direction" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.pointeIds) ? body.pointeIds.map(String).slice(0, 20) : [];
  if (!ids.length) return NextResponse.json({ error: "Sélectionnez au moins une pointe." }, { status: 400 });
  const message = String(body?.message ?? "").trim();
  const subject = String(body?.subject ?? "").trim() || "Pointe de trésorerie — Lotier Immobilier";

  // Destinataire : utilisateur choisi OU adresse email libre.
  let to = "";
  if (body?.recipientUserId) {
    const u = await prisma.user.findUnique({ where: { id: String(body.recipientUserId) }, select: { email: true, active: true } }).catch(() => null);
    if (!u?.email) return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 400 });
    to = u.email;
  } else {
    const e = String(body?.recipientEmail ?? "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
    to = e;
  }

  // Récupère les pointes sélectionnées (PDF + montant + date).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await prisma.$queryRawUnsafe(`SELECT id, service, "fileName", data, amount, "createdAt" FROM treso_pointe WHERE id = ANY($1::text[]) ORDER BY "createdAt" DESC`, ids).catch(() => [])) as any[];
  if (!rows.length) return NextResponse.json({ error: "Pointe(s) introuvable(s)." }, { status: 404 });

  // Garanties financières par service (rappel dans le mail).
  const gRows = await prisma.setting.findMany({ where: { key: { in: ["treso_garantie_gestion", "treso_garantie_syndic"] } } }).catch(() => []) as { key: string; value: string }[];
  const gMap = new Map(gRows.map(r => [r.key, parseFloat(r.value) || 0]));
  const garantieOf = (svc: string) => svc === "syndic" ? (gMap.get("treso_garantie_syndic") || 0) : (gMap.get("treso_garantie_gestion") || 0);

  const attachments: MailAttachment[] = rows.map(p => ({
    filename: String(p.fileName).endsWith(".pdf") ? p.fileName : `${p.fileName}.pdf`,
    content: Buffer.from(p.data, "base64"),
    contentType: "application/pdf",
  }));

  // Tableau récapitulatif : service, date, montant, garantie, dépassement.
  const rowsHtml = rows.map(p => {
    const svc = p.service === "syndic" ? "Syndic" : "Gestion locative";
    const dt = new Date(p.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    const g = garantieOf(p.service);
    const amt = p.amount != null ? Number(p.amount) : null;
    const exceeds = amt != null && g > 0 && amt > g;
    const td = "padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;";
    return `<tr>
      <td style="${td}color:#1C1A17;font-weight:600;">${svc}</td>
      <td style="${td}color:#6b7280;">${dt}</td>
      <td style="${td}text-align:right;font-weight:700;color:${exceeds ? "#B42318" : "#1C1A17"};">${amt != null ? fmtEuro(amt) : "—"}</td>
      <td style="${td}text-align:right;color:#6b7280;">${g > 0 ? fmtEuro(g) : "non définie"}</td>
      <td style="${td}text-align:right;">${exceeds ? `<span style="color:#B42318;font-weight:700;">⚠️ +${fmtEuro(amt! - g)}</span>` : `<span style="color:#2F855A;">OK</span>`}</td>
    </tr>`;
  }).join("");

  const contentHtml = `
    ${message ? textToHtml(message) : "<p>Bonjour,</p><p>Veuillez trouver ci-joint la pointe de trésorerie du moment.</p>"}
    <p style="margin:18px 0 6px;font-size:13px;font-weight:700;color:#1C1A17;">Récapitulatif</p>
    <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:8px;overflow:hidden;">
      <thead><tr>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Service</th>
        <th style="padding:8px 10px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;">Date</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;">Montant</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;">Garantie financière</th>
        <th style="padding:8px 10px;text-align:right;font-size:11px;color:#6b7280;text-transform:uppercase;">Écart</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">La pointe de trésorerie doit rester dans la limite de la garantie financière indiquée ci-dessus. Les documents détaillés (PDF) sont joints à ce message.</p>`;

  const ok = await sendMail({
    to,
    replyTo: SUPER_ADMIN_EMAIL,
    subject,
    html: renderBrandedEmail({ subject, contentHtml, senderName: session.user.name ?? undefined, preheader: subject }),
    attachments,
    transactional: true,
  }).catch(() => false);

  if (!ok) return NextResponse.json({ error: "Envoi impossible (configuration SMTP)." }, { status: 502 });
  return NextResponse.json({ ok: true, to, count: rows.length });
}
