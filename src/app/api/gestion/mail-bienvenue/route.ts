import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendMail, MailAttachment } from "@/lib/mailer";
import { buildWelcomeEmailHtml, buildRibPdf, welcomeSubject, tenantEmails, AGENCE, WelcomeData } from "@/lib/welcome-mail";
import { isCommercialRole } from "@/lib/admin";
import { SUPER_ADMIN_EMAIL, canManageContent } from "@/lib/superadmin";

export const maxDuration = 60;

// GET — dossiers enregistrés + infos de l'utilisateur courant (pré-remplissage
// de l'agent) + liste des agents commerciaux (choix par l'admin/gestionnaire).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const canConfig = canManageContent(session.user);

  // Historique des envois : l'admin/gestionnaire voit tous les envois (avec
  // l'auteur) ; un agent ne voit que les siens.
  const SEL = `SELECT d.id, d."tenantName", d.address, d."sentTo", d."createdAt", (u.prenom || ' ' || u.nom) AS "senderName" FROM welcome_dossier d LEFT JOIN users u ON u.id = d."createdBy"`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await (canConfig
    ? prisma.$queryRawUnsafe(`${SEL} ORDER BY d."createdAt" DESC LIMIT 100`)
    : prisma.$queryRawUnsafe(`${SEL} WHERE d."createdBy" = $1 ORDER BY d."createdAt" DESC LIMIT 100`, session.user.id)
  ).catch(() => [])) as any[];

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { prenom: true, nom: true, email: true, phone: true, roleId: true } }).catch(() => null);
  const iAmCommercial = isCommercialRole(me?.roleId);
  // L'admin / gestionnaire choisit l'agent commercial ; on lui fournit la liste.
  const agents = iAmCommercial ? [] : await prisma.user.findMany({
    where: { active: true, roleId: { in: ["agent", "commercial"] } },
    select: { id: true, prenom: true, nom: true, email: true, phone: true },
    orderBy: [{ prenom: "asc" }, { nom: "asc" }],
  }).catch(() => []);

  let defaultPdfName = "";
  if (canConfig) {
    const s = await prisma.setting.findUnique({ where: { key: "welcome_default_pdf_name" } }).catch(() => null);
    defaultPdfName = s?.value ?? "";
  }
  return NextResponse.json({ dossiers: rows, me: me ? { ...me, isCommercial: iAmCommercial } : null, agents, canConfig, defaultPdfName });
}

// POST — enregistre le dossier et envoie le mail de bienvenue depuis collab@,
// en copie à gestion@ et à l'agent commercial, réponse dirigée vers gestion@.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const data = (body?.data ?? {}) as WelcomeData;

  // Aperçu : renvoie le HTML sans envoyer ni enregistrer.
  if (body?.preview) return NextResponse.json({ html: buildWelcomeEmailHtml(data) });

  // Mail test : envoyé uniquement au super admin, sans copie ni enregistrement.
  const isTest = !!body?.test;
  const to = isTest ? [SUPER_ADMIN_EMAIL] : tenantEmails(data);
  if (!to.length) return NextResponse.json({ error: "Au moins un email de locataire est requis." }, { status: 400 });
  if (!isTest && !data.nom1 && !data.prenom1) return NextResponse.json({ error: "Le nom du locataire est requis." }, { status: 400 });

  // Copie : gestion@ + l'agent commercial (sauf pour un test).
  const ccList = new Set<string>();
  if (!isTest) {
    ccList.add(AGENCE.email);
    if (data.agentEmail && /@/.test(data.agentEmail)) ccList.add(data.agentEmail.trim());
  }

  const html = buildWelcomeEmailHtml(data);
  const subject = (isTest ? "[TEST] " : "") + welcomeSubject(data);

  // Pièces jointes : PDF joint par défaut (configuré par l'admin) OU RIB généré,
  // + PDF ajoutés dans le formulaire.
  const attachments: MailAttachment[] = [];
  const def = await getDefaultPdf();
  if (def) attachments.push(def);
  else { try { attachments.push({ filename: "RIB-LOTIER.pdf", content: await buildRibPdf(), contentType: "application/pdf" }); } catch { /* ignore */ } }
  if (Array.isArray(body?.attachments)) {
    for (const a of body.attachments) {
      if (a?.filename && a?.content) {
        try { attachments.push({ filename: String(a.filename).slice(0, 200), content: Buffer.from(String(a.content), "base64"), contentType: a.mime || "application/pdf" }); } catch { /* ignore */ }
      }
    }
  }

  let sent = false; let error = "";
  try {
    sent = await sendMail({ to: to.join(", "), cc: [...ccList].join(", ") || undefined, replyTo: AGENCE.email, subject, html, attachments, transactional: true });
    if (!sent) error = "Envoi impossible (configuration SMTP manquante).";
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (isTest) {
    if (!sent) return NextResponse.json({ ok: false, error: error || "Envoi échoué" }, { status: 502 });
    return NextResponse.json({ ok: true, test: true, sentTo: to });
  }

  // Enregistre le dossier dans Collab (même si l'envoi a échoué).
  const id = randomUUID();
  const tenantName = [data.prenom1, data.nom1].filter(Boolean).join(" ") + (data.nom2 ? ` & ${[data.prenom2, data.nom2].filter(Boolean).join(" ")}` : "");
  await prisma.$executeRawUnsafe(
    `INSERT INTO welcome_dossier (id, data, "tenantName", address, "sentTo", "createdBy") VALUES ($1, $2::jsonb, $3, $4, $5, $6)`,
    id, JSON.stringify(data), tenantName.slice(0, 200), (data.adresse || "").slice(0, 300), sent ? to.join(", ") : null, session.user.id,
  ).catch(() => {});

  if (!sent) return NextResponse.json({ ok: false, error: error || "Envoi échoué", saved: true }, { status: 502 });
  return NextResponse.json({ ok: true, id, sentTo: to, cc: [...ccList] });
}

// Récupère la pièce jointe PDF par défaut configurée par l'admin (setting).
async function getDefaultPdf(): Promise<MailAttachment | null> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: ["welcome_default_pdf", "welcome_default_pdf_name"] } } }) as { key: string; value: string }[];
    const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
    if (!map.welcome_default_pdf) return null;
    return { filename: (map.welcome_default_pdf_name || "document.pdf").slice(0, 200), content: Buffer.from(map.welcome_default_pdf, "base64"), contentType: "application/pdf" };
  } catch { return null; }
}
