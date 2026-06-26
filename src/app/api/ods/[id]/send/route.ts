import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

const ROLE_LABEL: Record<string, string> = {
  locataire: "Locataire", coproprietaire: "Copropriétaire",
  proprietaire: "Propriétaire", gardien: "Gardien", autre: "Contact",
};

// POST /api/ods/[id]/send — envoie l'ordre de service par email au fournisseur.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const ods = await prisma.serviceOrder.findUnique({
    where: { id },
    include: { supplier: { select: { name: true, email: true, phone: true } } },
  });
  if (!ods) return NextResponse.json({ error: "Ordre de service introuvable" }, { status: 404 });
  if (!ods.supplier?.email) return NextResponse.json({ error: "Le fournisseur n'a pas d'adresse email. Renseignez-la d'abord." }, { status: 400 });

  // Compte d'envoi : un compte mail accessible à l'utilisateur, avec SMTP.
  const uid = session.user.id;
  const accounts = await prisma.mailAccountConfig.findMany({ where: { active: true } });
  const acc = accounts.find(a => a.smtpHost && (a.createdBy === uid || a.sharedUserIds.includes(uid)))
           ?? accounts.find(a => a.smtpHost);
  if (!acc) return NextResponse.json({ error: "Aucun compte email avec SMTP configuré. Configurez la messagerie d'abord." }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: uid }, select: { prenom: true, nom: true } });
  const agentName = ods.agentName || `${me?.prenom ?? ""} ${me?.nom ?? ""}`.trim();

  // Jeton du portail fournisseur (créé si absent) + URL.
  let token = ods.supplierToken;
  if (!token) {
    token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await prisma.serviceOrder.update({ where: { id }, data: { supplierToken: token } });
  }
  const host = _req?.headers?.get?.("x-forwarded-host") || _req?.headers?.get?.("host");
  const proto = _req?.headers?.get?.("x-forwarded-proto") || "https";
  const portalUrl = `${host ? `${proto}://${host}` : (process.env.NEXTAUTH_URL || "https://collab.lotier-immobilier.com")}/intervention/${token}`;

  // ── Construction de l'email ──────────────────────────────────
  const L: string[] = [];
  L.push(`Bonjour,`);
  L.push(``);
  L.push(`Nous vous confions l'intervention suivante (réf. ${ods.ref}) :`);
  L.push(``);
  if (ods.interventionType) L.push(`• Type : ${ods.interventionType}`);
  L.push(`• Objet : ${ods.title}`);
  if (ods.description) L.push(`• Description : ${ods.description}`);
  if (ods.address) L.push(`• Lieu : ${ods.address}`);
  if (ods.urgency === "urgent") L.push(`• ⚠ URGENT`);
  if (ods.deadline) L.push(`• Délai souhaité : ${new Date(ods.deadline).toLocaleDateString("fr-FR")}`);
  L.push(``);
  if (ods.onSiteName || ods.onSitePhone) {
    const role = ods.onSiteRole ? ` (${ROLE_LABEL[ods.onSiteRole] ?? ods.onSiteRole})` : "";
    L.push(`Contact sur place${role} : ${[ods.onSiteName, ods.onSitePhone].filter(Boolean).join(" — ")}`);
  }
  if (ods.keyAtAgency) L.push(`Accès : le logement n'est pas loué — les clés sont à retirer à l'agence.`);
  if (ods.accessInfo) L.push(`Infos d'accès : ${ods.accessInfo}`);
  L.push(``);
  if (ods.quoteRequired) {
    L.push(`Merci de nous adresser un DEVIS avant toute intervention.`);
  } else if (ods.amount) {
    L.push(`Montant convenu / plafond sans devis : ${ods.amount.toLocaleString("fr-FR")} €.`);
  }
  L.push(`La facture est à adresser à l'agence (${acc.email}).`);
  L.push(``);
  L.push(`➡ Suivez cette intervention, déposez votre devis/facture/photos et échangez avec nous ici :`);
  L.push(portalUrl);
  L.push(``);
  // Pièces jointes (photos…)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const atts = Array.isArray(ods.attachments) ? (ods.attachments as any[]) : [];
  if (atts.length) L.push(`${atts.length} pièce(s) jointe(s) : ${atts.map(a => a.name).join(", ")}.`);
  L.push(`Pour toute question : ${agentName || "votre agence"}${ods.agentPhone ? ` — ${ods.agentPhone}` : ""}.`);
  L.push(`Cordialement,`);
  L.push(`${acc.name}`);
  const text = L.join("\n");

  const mailAttachments = atts
    .filter(a => a?.data && a?.name)
    .map(a => ({
      filename: String(a.name),
      content: Buffer.from(String(a.data), "base64"),
      contentType: a.mime ? String(a.mime) : undefined,
    }));

  const subject = `[${ods.ref}] ${ods.interventionType ? ods.interventionType + " — " : ""}${ods.title}`;

  const port = acc.smtpPort || 587;
  const isDirectSsl = acc.smtpSsl === true && port === 465;
  const transport = nodemailer.createTransport({
    host: acc.smtpHost, port, secure: isDirectSsl,
    requireTLS: !isDirectSsl && port !== 25,
    auth: { user: acc.username, pass: acc.password },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transport.sendMail({
      from: `"${acc.name}" <${acc.email}>`,
      to: ods.supplier.email,
      subject,
      text,
      html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#1C1A17">${text.replace(/\n/g, "<br/>")}</div>`,
      ...(mailAttachments.length ? { attachments: mailAttachments } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: `Envoi échoué : ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }

  const updated = await prisma.serviceOrder.update({
    where: { id },
    data: { status: ods.status === "brouillon" ? "envoyé" : ods.status, sentAt: new Date(), sentTo: ods.supplier.email },
    include: { supplier: { select: { id: true, name: true, type: true, phone: true, email: true } } },
  });

  return NextResponse.json({ ok: true, sentTo: ods.supplier.email, order: { ...updated, deadline: updated.deadline?.toISOString() ?? null, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString(), sentAt: updated.sentAt?.toISOString() ?? null } });
}
