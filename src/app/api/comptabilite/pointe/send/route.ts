import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessCompta } from "@/lib/comptabilite";
import { sendMail, MailAttachment } from "@/lib/mailer";
import { renderBrandedEmail, textToHtml } from "@/lib/email-template";

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

  // Récupère les pointes sélectionnées (PDF).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await prisma.$queryRawUnsafe(`SELECT id, service, "fileName", data FROM treso_pointe WHERE id = ANY($1::text[])`, ids).catch(() => [])) as any[];
  if (!rows.length) return NextResponse.json({ error: "Pointe(s) introuvable(s)." }, { status: 404 });

  const attachments: MailAttachment[] = rows.map(p => ({
    filename: String(p.fileName).endsWith(".pdf") ? p.fileName : `${p.fileName}.pdf`,
    content: Buffer.from(p.data, "base64"),
    contentType: "application/pdf",
  }));

  const liste = rows.map(p => `<li><strong>${p.service === "syndic" ? "Syndic" : "Gestion locative"}</strong> — ${p.fileName}</li>`).join("");
  const contentHtml = `
    ${message ? textToHtml(message) : "<p>Veuillez trouver ci-joint la pointe de trésorerie.</p>"}
    <p style="margin:16px 0 6px;font-size:13px;color:#6b7280;">Documents joints :</p>
    <ul style="margin:0;padding-left:18px;font-size:13px;color:#374151;">${liste}</ul>`;

  const ok = await sendMail({
    to,
    subject,
    html: renderBrandedEmail({ subject, contentHtml, senderName: session.user.name ?? undefined, preheader: subject }),
    attachments,
    transactional: true,
  }).catch(() => false);

  if (!ok) return NextResponse.json({ error: "Envoi impossible (configuration SMTP)." }, { status: 502 });
  return NextResponse.json({ ok: true, to, count: rows.length });
}
