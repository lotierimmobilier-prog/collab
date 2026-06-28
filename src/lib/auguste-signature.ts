// Signature e-mail d'Auguste, l'assistant IA de Lotier Immobilier.
// Utilisée pour les réponses automatiques (envoi de documents, etc.).

export const AUGUSTE_SIGNATURE_HTML = `
<table cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:2px solid #B8966A;padding-top:12px;font-family:Arial,Helvetica,sans-serif;color:#1C1A17;font-size:13px;line-height:1.5">
  <tr>
    <td style="vertical-align:top;padding-right:14px">
      <div style="width:44px;height:44px;border-radius:50%;background:#B8966A;color:#fff;font-size:22px;font-weight:bold;text-align:center;line-height:44px">A</div>
    </td>
    <td style="vertical-align:top">
      <div style="font-weight:bold;font-size:14px;color:#1C1A17">Auguste</div>
      <div style="color:#8a6d44;font-size:12px">Assistant virtuel — Lotier Immobilier</div>
      <div style="color:#6b6357;font-size:12px;margin-top:4px">
        ✉ <a href="mailto:contact@lotier-immobilier.com" style="color:#B8966A;text-decoration:none">contact@lotier-immobilier.com</a>
        &nbsp;·&nbsp; 🌐 <a href="https://www.lotier-immobilier.com" style="color:#B8966A;text-decoration:none">lotier-immobilier.com</a>
      </div>
      <div style="color:#9ca3af;font-size:11px;margin-top:6px;font-style:italic">
        Message préparé automatiquement par Auguste, l'assistant IA de Lotier Immobilier. Un conseiller reste à votre disposition.
      </div>
    </td>
  </tr>
</table>`.trim();

// Version texte (repli).
export const AUGUSTE_SIGNATURE_TEXT = [
  "",
  "Bien cordialement,",
  "",
  "Auguste",
  "Assistant virtuel — Lotier Immobilier",
  "contact@lotier-immobilier.com · lotier-immobilier.com",
  "",
  "— Message préparé automatiquement par Auguste, l'assistant IA de Lotier Immobilier. Un conseiller reste à votre disposition.",
].join("\n");
