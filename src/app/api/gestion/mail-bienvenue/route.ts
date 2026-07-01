import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendMail, MailAttachment } from "@/lib/mailer";
import { buildWelcomeEmailHtml, buildRibPdf, welcomeSubject, tenantEmails, AGENCE, WelcomeData } from "@/lib/welcome-mail";
import { isCommercialRole } from "@/lib/admin";

export const maxDuration = 60;

// GET — dossiers enregistrés + infos de l'utilisateur courant (pré-remplissage
// de l'agent) + liste des agents commerciaux (choix par l'admin/gestionnaire).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, "tenantName", address, "sentTo", "createdAt" FROM welcome_dossier WHERE "createdBy" = $1 ORDER BY "createdAt" DESC LIMIT 100`,
    session.user.id,
  ).catch(() => [])) as any[];

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { prenom: true, nom: true, email: true, phone: true, roleId: true } }).catch(() => null);
  const iAmCommercial = isCommercialRole(me?.roleId);
  // L'admin / gestionnaire choisit l'agent commercial ; on lui fournit la liste.
  const agents = iAmCommercial ? [] : await prisma.user.findMany({
    where: { active: true, roleId: { in: ["agent", "commercial"] } },
    select: { id: true, prenom: true, nom: true, email: true, phone: true },
    orderBy: [{ prenom: "asc" }, { nom: "asc" }],
  }).catch(() => []);

  return NextResponse.json({ dossiers: rows, me: me ? { ...me, isCommercial: iAmCommercial } : null, agents });
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

  const to = tenantEmails(data);
  if (!to.length) return NextResponse.json({ error: "Au moins un email de locataire est requis." }, { status: 400 });
  if (!data.nom1 && !data.prenom1) return NextResponse.json({ error: "Le nom du locataire est requis." }, { status: 400 });

  // Copie : gestion@ + l'agent commercial (s'il a renseigné son email).
  const ccList = new Set<string>([AGENCE.email]);
  if (data.agentEmail && /@/.test(data.agentEmail)) ccList.add(data.agentEmail.trim());

  const html = buildWelcomeEmailHtml(data);
  const subject = welcomeSubject(data);

  // Pièces jointes : RIB PDF auto + PDF ajoutés par l'agent.
  const attachments: MailAttachment[] = [];
  try { attachments.push({ filename: "RIB-LOTIER.pdf", content: await buildRibPdf(), contentType: "application/pdf" }); } catch { /* ignore */ }
  if (Array.isArray(body?.attachments)) {
    for (const a of body.attachments) {
      if (a?.filename && a?.content) {
        try { attachments.push({ filename: String(a.filename).slice(0, 200), content: Buffer.from(String(a.content), "base64"), contentType: a.mime || "application/pdf" }); } catch { /* ignore */ }
      }
    }
  }

  let sent = false; let error = "";
  try {
    sent = await sendMail({ to: to.join(", "), cc: [...ccList].join(", "), replyTo: AGENCE.email, subject, html, attachments, transactional: true });
    if (!sent) error = "Envoi impossible (configuration SMTP manquante).";
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  // Enregistre le dossier dans Collab (même si l'envoi a échoué, pour ne pas
  // perdre la saisie).
  const id = randomUUID();
  const tenantName = [data.prenom1, data.nom1].filter(Boolean).join(" ") + (data.nom2 ? ` & ${[data.prenom2, data.nom2].filter(Boolean).join(" ")}` : "");
  await prisma.$executeRawUnsafe(
    `INSERT INTO welcome_dossier (id, data, "tenantName", address, "sentTo", "createdBy") VALUES ($1, $2::jsonb, $3, $4, $5, $6)`,
    id, JSON.stringify(data), tenantName.slice(0, 200), (data.adresse || "").slice(0, 300), sent ? to.join(", ") : null, session.user.id,
  ).catch(() => {});

  if (!sent) return NextResponse.json({ ok: false, error: error || "Envoi échoué", saved: true }, { status: 502 });
  return NextResponse.json({ ok: true, id, sentTo: to, cc: [...ccList] });
}
