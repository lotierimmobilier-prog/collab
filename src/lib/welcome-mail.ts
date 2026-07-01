// Mail de bienvenue locataire : construction de l'email (styles en ligne pour
// compatibilité avec les clients mail) et génération du RIB en PDF.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const NAVY = "#1A3A5C";
const GOLD = "#B89968";
export const LOGO = "https://www.lotier-immobilier.com/wp-content/uploads/2020/10/Logo-der-1.png";
export const RIB = { banque: "DUPUY DE PERSEVAL", titulaire: "SARL LOTIER", iban: "FR76 1660 7004 4940 0009 6229 641", bic: "CCBPFRPPPPG", dom: "44 Bd Victor Hugo, 30000 Nîmes" };
export const AGENCE = { email: "gestion@lotier-immobilier.com", tel: "04 67 11 28 31", adresse: "38/40 rue Française, 34500 BÉZIERS" };

export interface WelcomeData {
  civilite: "M" | "Mme" | "MM" | "asso" | "societe";
  prenom1: string; nom1: string; email1: string;
  prenom2?: string; nom2?: string; email2?: string;
  agentPrenom?: string; agentNom?: string; agentTel?: string; agentEmail?: string;
  adresse?: string; etage?: string; numPorte?: string;
  typeLgt: "nu" | "meuble" | "commercial"; dateEntree?: string;
  loyer?: number; charges?: number; hono?: number; depot?: number;
  pdlEdf?: string; ancienEdf?: string; numEau?: string; ancienEau?: string; numGaz?: string; ancienGaz?: string;
}

const esc = (s?: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const num = (n?: number) => (typeof n === "number" && !isNaN(n) ? n : 0);
const civLabel = (c: string) => c === "Mme" ? "Madame" : c === "MM" ? "Monsieur et Madame" : c === "asso" ? "L'association" : c === "societe" ? "La société" : "Monsieur";
const typeLabel = (t: string) => t === "meuble" ? "Meublé" : t === "commercial" ? "Local commercial" : "Non meublé";
function locName(d: WelcomeData): string {
  const a = [d.prenom1, d.nom1].filter(Boolean).join(" ");
  const b = [d.prenom2, d.nom2].filter(Boolean).join(" ");
  return b ? `${a} et ${b}` : a;
}
function fmtDate(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso); if (!t) return "";
  return new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

// Calculs financiers : dépôt (selon type), prorata du 1er mois, total dû.
export function computeAmounts(d: WelcomeData) {
  const loyer = num(d.loyer), charges = num(d.charges), hono = num(d.hono);
  let depot = num(d.depot);
  if (!depot) depot = d.typeLgt === "meuble" ? loyer * 2 : d.typeLgt === "commercial" ? 0 : loyer;
  const base = loyer + charges;
  let jm = 30, jo = 0, pro = 0;
  if (d.dateEntree) {
    const dt = new Date(d.dateEntree);
    jm = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
    jo = jm - dt.getDate() + 1;
    pro = jm > 0 ? (base / jm) * jo : 0;
  }
  const total = pro + depot + hono;
  return { loyer, charges, hono, depot, base, jm, jo, pro, total };
}

export function welcomeSubject(d: WelcomeData): string {
  return `🏠 Bienvenue dans votre nouveau logement – ${locName(d)}${d.adresse ? " – " + d.adresse : ""}`;
}
export function tenantEmails(d: WelcomeData): string[] {
  return [d.email1, d.email2].map(e => (e || "").trim()).filter(Boolean);
}

// Construit le corps HTML complet du mail (styles en ligne).
export function buildWelcomeEmailHtml(d: WelcomeData): string {
  const a = computeAmounts(d);
  const civ = civLabel(d.civilite);
  const loc = esc(locName(d));
  const adr = esc(d.adresse);
  const tl = typeLabel(d.typeLgt);
  const de = fmtDate(d.dateEntree);
  const ag = esc([d.agentPrenom, d.agentNom].filter(Boolean).join(" ")) || "votre conseiller";
  const tel = esc(d.agentTel); const em = esc(d.agentEmail);
  const ini = (d.agentPrenom?.[0] || "") + (d.agentNom?.[0] || "");
  const depLabel = d.typeLgt === "meuble" ? "2 mois HC" : d.typeLgt === "commercial" ? "libre" : "1 mois HC";
  const hasGaz = !!(d.numGaz && d.numGaz.trim());
  const eur = (n: number) => `${n.toFixed(2)} €`;

  const row = (l: string, r: string) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;font-size:13px">${l}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#222;font-size:13px;font-weight:600">${r}</td></tr>`;
  const section = (title: string, inner: string) => `<div style="margin-bottom:22px"><div style="font-size:13px;font-weight:700;color:${NAVY};text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;border-left:3px solid ${GOLD};padding-left:10px">${title}</div>${inner}</div>`;

  return `
<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;border:1px solid #e0e0e0;border-radius:10px;overflow:hidden">
  <div style="background:#fff;padding:22px 32px;text-align:center;border-bottom:2px solid ${GOLD}">
    <img src="${LOGO}" alt="LOTIER" style="height:52px"><div style="color:${NAVY};font-size:12px;margin-top:6px;letter-spacing:.05em">Vente · Location · Syndic</div>
  </div>
  <div style="background:${GOLD};padding:20px 32px;text-align:center;color:#fff">
    <h1 style="font-size:21px;font-weight:700;margin:0">🏠 Bienvenue dans votre nouveau logement !</h1>
    <p style="font-size:13px;margin:6px 0 0;opacity:.9">${loc}${adr ? " · " + adr : ""}</p>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:14px;color:#444;margin:0 0 22px;line-height:1.7">${civ} ${loc},<br><br>Toute l'équipe LOTIER Immobilier est heureuse de vous accueillir en tant que nouveau locataire${adr ? " au <strong>" + adr + "</strong>" : ""}. Nous espérons que vous vous y sentirez pleinement chez vous.</p>

    ${section("📋 Informations sur votre arrivée", `
      <table style="width:100%;border-collapse:collapse;background:#fafafa;border-radius:8px;overflow:hidden">
        ${row("Type de logement", tl)}
        ${row("Date d'entrée", `${de || "[À confirmer]"} — à confirmer avec ${ag}${tel ? " · " + tel : ""}`)}
        ${row(`Loyer proratisé (${a.jo || "?"}j/${a.jm}j)`, a.pro > 0 ? eur(a.pro) : "[Montant]")}
        ${row("Honoraires d'agence", a.hono > 0 ? eur(a.hono) : "[Montant]")}
        ${row(`Dépôt de garantie (${depLabel})`, a.depot > 0 ? eur(a.depot) + " TTC" : "[Montant]")}
      </table>
      <div style="background:${NAVY};color:#fff;border-radius:8px;padding:14px 16px;margin-top:12px;text-align:center">
        <div style="font-size:11px;letter-spacing:.05em;opacity:.85">SOMME TOTALE À RÉGLER AVANT REMISE DES CLÉS</div>
        <div style="font-size:22px;font-weight:700;margin-top:4px">${a.total > 0 ? eur(a.total) + " TTC" : "[Total]"}</div>
      </div>
      <p style="font-size:12px;color:#888;margin-top:10px;line-height:1.6">À partir du mois prochain : <strong style="color:${NAVY}">${a.base > 0 ? eur(a.base) : "[Montant]"}</strong>${a.loyer > 0 ? ` (${eur(a.loyer)} loyer + ${eur(a.charges)} charges)` : ""}, avant le 5 de chaque mois.</p>`)}

    ${section("📝 Démarches avant votre installation", `
      <p style="font-size:13px;color:#444;line-height:1.7;margin:0"><strong>1. Paiement</strong> — Réglez le montant total avant la remise des clés (RIB en pièce jointe).<br>
      <strong>2. Assurance habitation</strong> — Attestation obligatoire avant l'entrée dans les lieux (assureur de votre choix).<br>
      <strong>3. Signature du bail</strong> — Via YouSign (diagnostics et notice d'information inclus).</p>`)}

    ${section("⚡ Ouverture de vos contrats énergie — Papernest", `
      <div style="background:#eef6ff;border:1px solid #b8d4f0;border-radius:8px;padding:12px 16px;font-size:13px;color:${NAVY};line-height:1.6">Notre partenaire <strong>Papernest</strong> vous appellera pour prendre en charge l'ouverture de vos contrats d'énergie. Ce service est <strong>100 % gratuit</strong> et inclus dans votre accompagnement LOTIER — accueillez bien leur appel !</div>
      <p style="font-size:12px;color:#666;margin:10px 0 4px">Références utiles :</p>
      <div style="font-size:12px;color:#444;line-height:1.7">🔌 Électricité — PDL : <strong>${esc(d.pdlEdf) || "[PDL]"}</strong> · Ancien titulaire : ${esc(d.ancienEdf) || "[Nom]"}<br>
      💧 Eau (SUEZ) — N° : <strong>${esc(d.numEau) || "[N°]"}</strong> · Ancien titulaire : ${esc(d.ancienEau) || "[Nom]"}${hasGaz ? `<br>🔥 Gaz — N° : <strong>${esc(d.numGaz)}</strong> · Ancien titulaire : ${esc(d.ancienGaz) || "[Nom]"}` : ""}</div>`)}

    ${section("💳 RIB pour vos virements", `
      <table style="width:100%;border-collapse:collapse;background:#f8f5f0;border-radius:8px;overflow:hidden">
        ${row("Titulaire", RIB.titulaire)}${row("Banque", RIB.banque)}${row("IBAN", RIB.iban)}${row("BIC", RIB.bic)}${row("Domiciliation", RIB.dom)}
      </table>
      <p style="font-size:11px;color:#888;margin-top:8px">📎 Le RIB est également joint à ce mail en PDF.</p>`)}

    ${section("📞 Votre contact chez LOTIER", `
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:46px;height:46px;border-radius:50%;background:${NAVY};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:700;font-size:16px">${esc(ini) || "L"}</div>
        <div style="font-size:13px;color:#444;line-height:1.6"><strong>${ag}</strong><br>📧 ${em || "[email]"}<br>📱 ${tel || "[tél]"}<br>☎️ Standard : ${AGENCE.tel}</div>
      </div>`)}

    <div style="background:#fff8ec;border:1px solid #f0d080;border-radius:8px;padding:14px 16px;font-size:13px;color:#5a3e00;line-height:1.7;margin-bottom:22px">
      <strong>⚠️ Ouverture des compteurs — condition d'entrée.</strong> L'ouverture de vos compteurs devra être confirmée avant votre entrée dans les lieux. À défaut, les installations ne pourront pas être testées et tout dysfonctionnement constaté ultérieurement sera sous votre responsabilité. En cas d'absence à l'état des lieux ou de report signalé moins de 48h avant, des frais de déplacement de <strong style="color:#993C1D">150 € TTC</strong> vous seront facturés.
    </div>

    <div style="background:#f2f5f9;border:1px solid #c8d6e8;border-radius:8px;padding:16px 20px;margin-bottom:22px">
      <p style="font-size:12px;font-weight:700;color:${NAVY};text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px">ℹ️ Après votre installation — contacts agence</p>
      <p style="font-size:13px;color:#444;line-height:1.7;margin:0">Une fois votre bail signé, toutes vos demandes doivent être adressées à l'agence : <strong>☎️ ${AGENCE.tel}</strong> · <strong>✉️ ${AGENCE.email}</strong>.</p>
      <p style="font-size:12px;color:#888;line-height:1.6;border-top:1px solid #dde4ee;padding-top:10px;margin:10px 0 0">Merci de ne pas répondre directement à ce message : pour toute question, écrivez à <strong>${AGENCE.email}</strong>. ${ag} intervient pour la mise en location uniquement.</p>
    </div>

    <p style="font-size:13px;color:#666;text-align:center;margin:8px 0 0;line-height:1.6">Nous restons à votre disposition pour toute question.<br><strong style="color:${NAVY}">Bienvenue chez vous, et bonne installation !</strong></p>
  </div>
  <div style="background:#fafafa;padding:18px 32px;text-align:center;border-top:1px solid #eee">
    <img src="${LOGO}" alt="LOTIER" style="height:34px"><p style="font-size:11px;color:#999;margin:8px 0 0;line-height:1.6">LOTIER Immobilier — Votre partenaire immobilier de confiance<br><a href="mailto:${AGENCE.email}" style="color:${GOLD}">${AGENCE.email}</a> · ${AGENCE.tel}<br>${AGENCE.adresse}</p>
  </div>
</div>`;
}

// Génère un PDF simple du RIB de l'agence (pièce jointe automatique).
export async function buildRibPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0x1a / 255, 0x3a / 255, 0x5c / 255);
  const gold = rgb(0xb8 / 255, 0x99 / 255, 0x68 / 255);
  let y = 780;
  page.drawText("RELEVÉ D'IDENTITÉ BANCAIRE", { x: 50, y, size: 18, font: bold, color: navy });
  y -= 12; page.drawRectangle({ x: 50, y, width: 495, height: 3, color: gold });
  y -= 40;
  const line = (label: string, value: string) => {
    page.drawText(label, { x: 50, y, size: 11, font: bold, color: navy });
    page.drawText(value, { x: 200, y, size: 11, font });
    y -= 26;
  };
  line("Titulaire", RIB.titulaire);
  line("Banque", RIB.banque);
  line("IBAN", RIB.iban);
  line("BIC / SWIFT", RIB.bic);
  line("Domiciliation", RIB.dom);
  y -= 20;
  page.drawText("LOTIER Immobilier", { x: 50, y, size: 11, font: bold, color: navy }); y -= 18;
  page.drawText(`${AGENCE.adresse}  ·  ${AGENCE.tel}  ·  ${AGENCE.email}`, { x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
