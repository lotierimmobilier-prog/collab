import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta } from "@/lib/comptabilite";
import { extractPointeAmount, buildAlertPdf } from "@/lib/treso-pointe";
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail, emailBaseUrl } from "@/lib/email-template";
import { fmtEuro } from "@/lib/comptabilite";

export const maxDuration = 60;
const MAX_BYTES = 20 * 1024 * 1024;
const SERVICES = ["gestion", "syndic"];

async function guard() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!canAccessCompta((session.user as { roleId?: string }).roleId)) return { error: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  return { session };
}

async function garanties() {
  const rows = await prisma.setting.findMany({ where: { key: { in: ["treso_garantie_gestion", "treso_garantie_syndic", "treso_notify_user"] } } }) as { key: string; value: string }[];
  const m = new Map(rows.map(r => [r.key, r.value]));
  return {
    gestion: parseFloat(m.get("treso_garantie_gestion") || "0") || 0,
    syndic: parseFloat(m.get("treso_garantie_syndic") || "0") || 0,
    notifyUserId: m.get("treso_notify_user") || "",
  };
}

// Envoie l'alerte de dépassement (email + PDF d'alerte + PDF concerné en pièce jointe).
async function sendAlert(pointe: { id: string; service: string; fileName: string; amount: number; data: string }, garantie: number, notifyUserId: string): Promise<boolean> {
  if (!notifyUserId) return false;
  const u = await prisma.user.findUnique({ where: { id: notifyUserId }, select: { email: true, prenom: true, nom: true, active: true } }).catch(() => null);
  if (!u?.active || !u.email) return false;
  const link = `${emailBaseUrl()}/api/comptabilite/pointe/${pointe.id}`;
  const svc = pointe.service === "gestion" ? "Gestion locative" : "Syndic";
  let alertPdf: Uint8Array | null = null;
  try { alertPdf = await buildAlertPdf({ service: pointe.service, amount: pointe.amount, garantie, fileName: pointe.fileName, link }); } catch { /* PDF facultatif */ }

  const contentHtml = `
    <p style="margin:0 0 12px;font-size:15px;color:#B42318;font-weight:700;">⚠️ Dépassement de la garantie financière — ${svc}</p>
    <p style="margin:0 0 8px;">Le montant de la dernière pointe de trésorerie dépasse le plafond de votre garantie financière :</p>
    <ul style="margin:0 0 12px;padding-left:18px;">
      <li>Montant de la pointe : <strong>${fmtEuro(pointe.amount)}</strong></li>
      <li>Garantie financière : ${fmtEuro(garantie)}</li>
      <li>Dépassement : <strong style="color:#B42318;">${fmtEuro(pointe.amount - garantie)}</strong></li>
    </ul>
    <p style="margin:0 0 12px;">Document concerné : <a href="${link}" style="color:#B8966A;">${pointe.fileName}</a></p>`;

  const attachments = [
    { filename: pointe.fileName.endsWith(".pdf") ? pointe.fileName : `${pointe.fileName}.pdf`, content: Buffer.from(pointe.data, "base64"), contentType: "application/pdf" },
    ...(alertPdf ? [{ filename: `alerte-${pointe.service}.pdf`, content: Buffer.from(alertPdf), contentType: "application/pdf" }] : []),
  ];

  return await sendMail({
    to: u.email,
    subject: `⚠️ Alerte garantie financière — pointe ${svc} (${fmtEuro(pointe.amount)})`,
    html: renderBrandedEmail({ subject: "Alerte garantie financière", contentHtml, preheader: `Pointe ${svc} : ${fmtEuro(pointe.amount)} > ${fmtEuro(garantie)}` }),
    attachments,
    transactional: true,
  }).catch(() => false);
}

// GET — garanties + utilisateur alerté + liste des pointes (avec dépassement).
export async function GET() {
  const g = await guard(); if (g.error) return g.error;
  const config = await garanties();
  let rows: { id: string; service: string; fileName: string; amount: number | null; createdAt: Date }[] = [];
  try {
    rows = await prisma.$queryRawUnsafe(`SELECT id, service, "fileName", amount, "createdAt" FROM treso_pointe ORDER BY "createdAt" DESC`);
  } catch { /* table absente */ }
  const pointes = rows.map(r => ({
    id: r.id, service: r.service, fileName: r.fileName, amount: r.amount,
    createdAt: new Date(r.createdAt).toISOString(),
    garantie: r.service === "syndic" ? config.syndic : config.gestion,
    exceeds: r.amount != null && (r.service === "syndic" ? config.syndic : config.gestion) > 0 && r.amount > (r.service === "syndic" ? config.syndic : config.gestion),
  }));
  return NextResponse.json({ ...config, pointes });
}

// POST — téléverser une pointe. { service, fileName, data(base64), amount? }
export async function POST(req: NextRequest) {
  const g = await guard(); if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const service = String(body?.service ?? "");
  const fileName = String(body?.fileName ?? "pointe.pdf").slice(0, 200);
  const data = String(body?.data ?? "");
  if (!SERVICES.includes(service)) return NextResponse.json({ error: "Service invalide (gestion/syndic)" }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  if (Math.ceil((data.length * 3) / 4) > MAX_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 20 Mo)" }, { status: 413 });

  // Montant : saisi manuellement, sinon lu par Auguste dans le PDF.
  let amount: number | null = typeof body?.amount === "number" ? body.amount : null;
  if (amount == null) amount = await extractPointeAmount(data);

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO treso_pointe (id, service, "fileName", data, amount, "createdBy") VALUES ($1,$2,$3,$4,$5,$6)`,
    id, service, fileName, data, amount, g.session!.user.id,
  );

  // Alerte si dépassement.
  const config = await garanties();
  const garantie = service === "syndic" ? config.syndic : config.gestion;
  let emailSent = false;
  const exceeds = amount != null && garantie > 0 && amount > garantie;
  if (exceeds) emailSent = await sendAlert({ id, service, fileName, amount: amount as number, data }, garantie, config.notifyUserId);

  return NextResponse.json({ ok: true, id, amount, garantie, exceeds, emailSent });
}

// PATCH — corriger le montant d'une pointe (saisie manuelle). { id, amount }
export async function PATCH(req: NextRequest) {
  const g = await guard(); if (g.error) return g.error;
  const { id, amount } = await req.json().catch(() => ({}));
  if (!id || typeof amount !== "number") return NextResponse.json({ error: "id et montant requis" }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await prisma.$queryRawUnsafe(`SELECT id, service, "fileName", data FROM treso_pointe WHERE id = $1`, String(id)).catch(() => [])) as any[];
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  await prisma.$executeRawUnsafe(`UPDATE treso_pointe SET amount = $1 WHERE id = $2`, amount, String(id));

  const config = await garanties();
  const garantie = p.service === "syndic" ? config.syndic : config.gestion;
  let emailSent = false;
  const exceeds = garantie > 0 && amount > garantie;
  if (exceeds) emailSent = await sendAlert({ id: p.id, service: p.service, fileName: p.fileName, amount, data: p.data }, garantie, config.notifyUserId);
  return NextResponse.json({ ok: true, amount, garantie, exceeds, emailSent });
}

// DELETE ?id=
export async function DELETE(req: NextRequest) {
  const g = await guard(); if (g.error) return g.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await prisma.$executeRawUnsafe(`DELETE FROM treso_pointe WHERE id = $1`, id).catch(() => {});
  return NextResponse.json({ ok: true });
}
