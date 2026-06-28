// Génération + dépôt automatique d'une quittance de loyer dans l'espace du
// locataire à chaque encaissement.
import { addAgencyDoc } from "@/lib/client-docs";

const eur = (n: number) => (Math.round(n * 100) / 100).toLocaleString("fr-FR") + " €";

function periodeLabel(p: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(p || "");
  if (!m) return p || "";
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${mois[parseInt(m[2], 10) - 1] ?? ""} ${m[1]}`;
}

function quittanceHtml(o: { nom: string; periode: string; montant: number; adresse: string; date: Date; mode: string }): string {
  const dfr = (d: Date) => new Date(d).toLocaleDateString("fr-FR", { dateStyle: "long" });
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Quittance de loyer — ${periodeLabel(o.periode)}</title>
<style>body{font-family:Georgia,'Times New Roman',serif;color:#1C1A17;max-width:720px;margin:0 auto;padding:40px 32px;line-height:1.7}
.hd{text-align:center;border-bottom:2px solid #B8966A;padding-bottom:16px;margin-bottom:24px}
.hd .b{font-family:Arial,sans-serif;font-size:24px;letter-spacing:4px;font-weight:bold}.hd .b span{color:#B8966A}
h1{font-size:19px;text-align:center;margin:22px 0 26px;text-transform:uppercase;letter-spacing:1px}
.amount{font-size:22px;font-weight:bold;color:#B8966A;text-align:center;margin:18px 0}
.print{position:fixed;top:16px;right:16px;background:#B8966A;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-family:Arial,sans-serif;font-size:13px;cursor:pointer}@media print{.print{display:none}}
.sig{margin-top:42px;text-align:right}</style></head>
<body>
<button class="print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
<div class="hd"><div class="b">LOTIER<span> IMMOBILIER</span></div><div style="font-family:Arial,sans-serif;font-size:11px;color:#B8966A;letter-spacing:2px;text-transform:uppercase;margin-top:6px">Votre agence de confiance</div></div>
<h1>Quittance de loyer</h1>
<p>Nous, société <strong>Lotier Immobilier</strong>, mandataire de gestion, donnons quittance à <strong>${o.nom}</strong>, locataire du logement situé <strong>${o.adresse}</strong>, du paiement du loyer et des charges pour la période de <strong>${periodeLabel(o.periode)}</strong>.</p>
<div class="amount">${eur(o.montant)}</div>
<p>Reçu le ${dfr(o.date)}${o.mode ? ` par ${o.mode}` : ""}. Cette quittance annule tous les reçus antérieurs pour la même période.</p>
<div class="sig"><p>Fait le ${dfr(new Date())},<br/>Pour Lotier Immobilier</p></div>
</body></html>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function depositQuittance(enc: any): Promise<void> {
  const bail = enc?.bail;
  if (!bail) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenants = (bail.tenants ?? []).map((bt: any) => bt.tenant).filter(Boolean);
  if (!tenants.length) return;
  const periode: string = enc.appel?.periode || new Date(enc.dateReglement).toISOString().slice(0, 7);
  const adresse: string = bail.lot?.address || "le logement loué";
  const montant: number = enc.montant ?? 0;
  for (const t of tenants) {
    const html = quittanceHtml({ nom: `${t.prenom} ${t.nom}`.trim(), periode, montant, adresse, date: enc.dateReglement, mode: enc.modePaiement });
    const data = Buffer.from(html, "utf8").toString("base64");
    await addAgencyDoc(t.id, "quittance", `Quittance ${periode}.html`, "text/html", Buffer.byteLength(html), data).catch(() => {});
  }
}
