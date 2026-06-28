import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { gedDocAllowed } from "@/lib/ics";
import { getValidGedToken, gedLevelForUser } from "@/lib/ics-ged-auth";
import { gedFindDocuments, gedFile } from "@/lib/ics-ged";
import { AUGUSTE_SIGNATURE_HTML } from "@/lib/auguste-signature";

export const runtime = "nodejs";
export const maxDuration = 60;

// Type de document demandé (déduit du sujet + corps).
function detectDocType(text: string): { type: string; label: string; gedRegex: RegExp | null } {
  const t = text.toLowerCase();
  if (/(état|etat)[\s’'-]*des[\s’'-]*lieux|\bedl\b/.test(t)) return { type: "edl", label: "votre état des lieux", gedRegex: /(état|etat).{0,8}lieux|edl/i };
  if (/\bbail\b|contrat de location/.test(t)) return { type: "bail", label: "une copie de votre bail", gedRegex: /bail/i };
  if (/quittance/.test(t)) return { type: "quittance", label: "votre quittance de loyer", gedRegex: null };
  if (/attestation/.test(t)) return { type: "attestation", label: "l'attestation demandée", gedRegex: null };
  return { type: "autre", label: "le document demandé", gedRegex: null };
}

function escapeHtml(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// POST /api/mail/ged-reply — prépare une réponse pro avec le document du client
// joint depuis la GED ICS. body: { fromEmail, fromName, subject, body, accountId }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const fromEmail = String(b?.fromEmail ?? "").trim();
  const fromName = String(b?.fromName ?? "").trim();
  const text = `${String(b?.subject ?? "")}\n${String(b?.body ?? "")}`;

  const doc = detectDocType(text);

  // 1) Correspondance expéditeur ↔ contact (locataire ICS) par e-mail.
  const tenant = fromEmail
    ? await prisma.icsTenant.findFirst({ where: { email: { equals: fromEmail, mode: "insensitive" } } }).catch(() => null)
    : null;
  const matched = !!tenant;
  const clientName = tenant
    ? `${tenant.prenomLocataire ?? ""} ${tenant.nomLocataire ?? ""}`.trim() || fromName || "Madame, Monsieur"
    : (fromName || "Madame, Monsieur");
  // La GED est rangée par propriétaire : on cherche par propriétaire, sinon par locataire.
  const searchName = tenant?.nomProprietaire || (tenant ? `${tenant.prenomLocataire ?? ""} ${tenant.nomLocataire ?? ""}`.trim() : fromName);

  // 2) Récupération du document dans la GED (bail / état des lieux uniquement).
  let attachment: { filename: string; mime: string; size: number; content: string } | null = null;
  let gedNote = "";
  const level = (await gedLevelForUser(session.user.id).catch(() => "none")) as "none" | "restreint" | "complet";
  if (level === "none") {
    gedNote = "Votre compte n'a pas accès à la GED : le document n'a pas pu être joint automatiquement.";
  } else if (doc.gedRegex && searchName) {
    try {
      const tk = await getValidGedToken();
      if (!tk.token) { gedNote = tk.error ?? "Accès GED indisponible."; }
      else {
        const found = await gedFindDocuments(tk.apiBase, tk.token, searchName, 30);
        const hit = (found.docs ?? []).find(d => doc.gedRegex!.test(d.nom) && gedDocAllowed(d.nom, level));
        if (hit) {
          const res = await gedFile(tk.apiBase, tk.token, hit.emplacement, hit.guid);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const filename = /\.[a-z0-9]{2,4}$/i.test(hit.nom) ? hit.nom : `${hit.nom}.pdf`;
            attachment = { filename: filename.replace(/[^\w.\-]/g, "_"), mime: res.headers.get("content-type") || "application/pdf", size: buf.length, content: buf.toString("base64") };
          } else gedNote = `Document trouvé mais téléchargement impossible (HTTP ${res.status}).`;
        } else gedNote = "Aucun document correspondant trouvé dans la GED pour ce contact.";
      }
    } catch (e) { gedNote = `GED indisponible : ${(e as Error).message}`; }
  } else if (!doc.gedRegex) {
    gedNote = "Ce type de document n'est pas récupérable automatiquement depuis la GED — à joindre manuellement.";
  }

  // 3) Réponse professionnelle, signée Auguste.
  const intro = attachment
    ? `Suite à votre demande, vous trouverez ci-joint ${doc.label}.`
    : `Nous avons bien reçu votre demande concernant ${doc.label}. Votre conseiller la traite et vous le transmettra dans les meilleurs délais.`;
  const replyHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1C1A17;line-height:1.6">
  <p>Bonjour ${escapeHtml(clientName)},</p>
  <p>${intro}</p>
  <p>Nous restons à votre disposition pour toute information complémentaire.</p>
</div>
${AUGUSTE_SIGNATURE_HTML}`.trim();

  // Réglage global : envoi 100 % automatique quand l'expéditeur est reconnu.
  const autoSetting = await prisma.setting.findUnique({ where: { key: "auguste_auto_send_ged" } }).catch(() => null);
  const autoSend = autoSetting?.value === "1";

  return NextResponse.json({
    ok: true,
    isRequest: doc.type !== "autre",
    docType: doc.type,
    docLabel: doc.label,
    matched,            // l'expéditeur correspond à un locataire connu
    contactName: clientName,
    found: !!attachment,
    attachment,
    replyHtml,
    note: gedNote,
    autoSend,           // réglage admin : envoi auto autorisé
    // matched + found → l'agent peut envoyer ; sinon contrôle requis.
    mode: matched && attachment ? "ready" : "review",
  });
}
