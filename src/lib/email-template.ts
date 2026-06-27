// Mise en page professionnelle des emails sortants, aux couleurs de
// Lotier Immobilier (or #B8966A sur fond sombre). Table-based + styles inline
// pour une compatibilité maximale avec les clients mail (Outlook, Gmail…).

const GOLD = "#B8966A";
const DARK = "#1C1A17";
const BORDER = "#E6E1D9";
const PAGE_BG = "#F3F1EC";
const FOOT_BG = "#FAF7F2";
const MUTED = "#9b8e79";

export function emailBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://collab.lotier-immobilier.com").replace(/\/$/, "");
}

// Convertit un corps en texte simple vers du HTML (sauts de ligne).
export function textToHtml(text: string): string {
  const esc = (text ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:${DARK}">${esc.replace(/\n/g, "<br/>")}</div>`;
}

export interface BrandedEmailOptions {
  subject: string;
  contentHtml: string;     // contenu déjà en HTML (corps + signature)
  viewUrl?: string;        // lien « voir la version en ligne »
  senderName?: string;     // nom de l'expéditeur (agent) affiché en pied
  preheader?: string;      // texte d'aperçu (masqué)
}

// Enveloppe le contenu d'un email dans la charte Lotier Immobilier.
export function renderBrandedEmail({ subject, contentHtml, viewUrl, senderName, preheader }: BrandedEmailOptions): string {
  const site = emailBaseUrl();
  const pre = (preheader || subject || "").replace(/<[^>]+>/g, "").slice(0, 140);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<title>${escapeAttr(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(pre)}</div>
  ${viewUrl ? `<div style="text-align:center;padding:10px 12px 0;font-family:Arial,sans-serif;font-size:11px;color:${MUTED};">
    Ce message ne s'affiche pas correctement ? <a href="${escapeAttr(viewUrl)}" style="color:${GOLD};text-decoration:underline;">Voir la version en ligne</a>
  </div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};padding:20px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04);">
        <tr><td style="background:${DARK};padding:22px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="font-family:Georgia,'Times New Roman',serif;color:#ffffff;font-size:21px;letter-spacing:3px;font-weight:bold;">LOTIER<span style="color:${GOLD};font-weight:normal;"> IMMOBILIER</span></td>
            <td align="right" style="font-family:Arial,sans-serif;color:${GOLD};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;">Votre agence de confiance</td>
          </tr></table>
        </td></tr>
        <tr><td style="height:3px;background:${GOLD};line-height:3px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:${DARK};">
          ${contentHtml}
        </td></tr>
        <tr><td style="background:${FOOT_BG};border-top:1px solid ${BORDER};padding:18px 28px;font-family:Arial,sans-serif;font-size:11px;color:${MUTED};line-height:1.7;">
          ${senderName ? `<strong style="color:${DARK};">${escapeHtml(senderName)}</strong> · ` : ""}Lotier Immobilier<br/>
          <a href="${site}" style="color:${GOLD};text-decoration:none;">${site.replace(/^https?:\/\//, "")}</a>
          <div style="margin-top:10px;color:#bcb3a3;">Ce courriel vous est adressé par Lotier Immobilier. Si ce message ne vous était pas destiné, merci de l'ignorer.</div>
        </td></tr>
      </table>
      <div style="font-family:Arial,sans-serif;font-size:10px;color:#c4bcae;padding-top:12px;">© Lotier Immobilier</div>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
