import { NextResponse } from "next/server";
import { getClientFromCookie } from "@/lib/client-auth";
import { prisma } from "@/lib/prisma";
import { tenantLoyer } from "@/lib/client-data";

// GET /api/client/attestation-loyer — attestation de loyer imprimable (PDF via
// le navigateur), générée à partir du dossier du locataire connecté.
export async function GET() {
  const client = await getClientFromCookie();
  if (!client) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const link: any = await prisma.bailTenant.findFirst({
    where: { tenantId: client.id },
    include: { bail: { include: { lot: true } } },
    orderBy: { id: "desc" },
  }).catch(() => null);

  const bail = link?.bail;
  const lot = bail?.lot;
  const adresse = lot?.address || lot?.adresse || lot?.reference || "le logement loué";
  const loyer = bail ? (bail.monthlyRent ?? 0) + (bail.charges ?? 0) : 0;
  const eur = (n: number) => n.toLocaleString("fr-FR") + " €";

  const loy = await tenantLoyer(client.id);
  const aJour = loy.hasBail && loy.soldeStatut !== "à payer";
  const today = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" });
  const nom = `${client.prenom} ${client.nom}`.trim();

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Attestation de loyer — ${nom}</title>
<style>
  body{font-family:Georgia,'Times New Roman',serif;color:#1C1A17;max-width:720px;margin:0 auto;padding:40px 32px;line-height:1.7}
  .hd{text-align:center;border-bottom:2px solid #B8966A;padding-bottom:16px;margin-bottom:28px}
  .hd .b{font-family:Arial,sans-serif;font-size:24px;letter-spacing:4px;font-weight:bold}
  .hd .b span{color:#B8966A}
  h1{font-size:19px;text-align:center;margin:24px 0 28px;text-transform:uppercase;letter-spacing:1px}
  .print{position:fixed;top:16px;right:16px;background:#B8966A;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-family:Arial,sans-serif;font-size:13px;cursor:pointer}
  @media print{.print{display:none}}
  .sig{margin-top:48px;text-align:right}
</style></head>
<body>
  <button class="print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  <div class="hd"><div class="b">LOTIER<span> IMMOBILIER</span></div><div style="font-family:Arial,sans-serif;font-size:11px;color:#B8966A;letter-spacing:2px;text-transform:uppercase;margin-top:6px">Votre agence de confiance</div></div>
  <h1>Attestation de loyer</h1>
  <p>Je soussignée, la société <strong>Lotier Immobilier</strong>, agissant en qualité de mandataire de gestion locative, atteste que :</p>
  <p style="margin:18px 0"><strong>${nom}</strong>${bail ? `, locataire du logement situé <strong>${adresse}</strong>` : ""},</p>
  ${bail ? `<p>est titulaire d'un bail d'habitation portant sur ce logement, pour un loyer mensuel charges comprises de <strong>${eur(loyer)}</strong>.</p>` : `<p>est référencé(e) dans nos services.</p>`}
  <p style="margin:18px 0">${aJour
      ? "À ce jour, le locataire est <strong>à jour</strong> du paiement de ses loyers et charges."
      : "La situation de paiement du locataire est consultable auprès de notre agence."}</p>
  <p>La présente attestation est délivrée pour servir et valoir ce que de droit (notamment auprès des organismes tels que la CAF).</p>
  <div class="sig">
    <p>Fait le ${today},<br/>Pour Lotier Immobilier</p>
  </div>
</body></html>`;

  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
