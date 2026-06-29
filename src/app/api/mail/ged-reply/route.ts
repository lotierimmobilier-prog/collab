import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { gedDocAllowed } from "@/lib/ics";
import { getValidGedToken, gedLevelForUser } from "@/lib/ics-ged-auth";
import { gedFindDocuments, gedFile } from "@/lib/ics-ged";
import { augusteSignatureHtml } from "@/lib/auguste-signature";

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

  // Étape 2 (confirmation) : l'agent a validé QUI / QUEL document chercher.
  const confirmTenantId = b?.confirmTenantId ? String(b.confirmTenantId) : "";
  const doc = (() => {
    const forced = b?.confirmDocType ? String(b.confirmDocType) : "";
    if (forced) { const d = detectDocType(forced); if (d.gedRegex || forced) return d; }
    return detectDocType(text);
  })();

  // 1a) Correspondance par E-MAIL (la plus fiable) : l'expéditeur est-il le
  //     locataire enregistré ?
  const emailTenant = fromEmail
    ? await prisma.icsTenant.findFirst({ where: { email: { equals: fromEmail, mode: "insensitive" } } }).catch(() => null)
    : null;

  // 1b) Correspondance par NOM / SIGNATURE : on repère TOUS les locataires dont
  //     le prénom ET le nom apparaissent dans l'expéditeur ou le corps.
  const hints = `${fromName} ${String(b?.body ?? "")}`.toLowerCase();
  const words = [...new Set(hints.split(/[^a-zàâäéèêëïîôöùûüç]+/i).filter(w => w.length >= 3))].slice(0, 12);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nameCands: any[] = [];
  if (words.length) {
    const cands = await prisma.icsTenant.findMany({
      where: { OR: words.flatMap(w => [{ nomLocataire: { contains: w, mode: "insensitive" as const } }, { prenomLocataire: { contains: w, mode: "insensitive" as const } }]) },
      take: 25,
    }).catch(() => []);
    nameCands = cands.filter(t => {
      const nom = (t.nomLocataire ?? "").toLowerCase(), pre = (t.prenomLocataire ?? "").toLowerCase();
      return nom.length >= 2 && pre.length >= 2 && hints.includes(nom) && hints.includes(pre);
    });
  }
  const nameTenant = nameCands.find(t => !emailTenant || t.id === emailTenant.id) ?? (emailTenant ? null : nameCands[0] ?? null);

  // Résolution du locataire : confirmé par l'agent > e-mail > nom unique.
  const confirmed = confirmTenantId
    ? await prisma.icsTenant.findUnique({ where: { id: confirmTenantId } }).catch(() => null)
    : null;
  const tenant = confirmed ?? emailTenant ?? nameTenant;
  const emailMatch = !!emailTenant;
  const nameMatch = !!nameTenant;
  // Incohérence : le nom/signature correspond à un locataire, mais l'e-mail
  // expéditeur n'est PAS le sien → contrôle d'identité requis.
  const mismatch = !emailMatch && nameMatch;
  const tenantEmail = nameTenant?.email ?? null;

  // CONTRÔLE DU NOM dans le mail (expéditeur) ET dans le texte (corps/signature).
  // Pour l'envoi AUTO, on exige que le nom du locataire (prénom + nom) apparaisse
  // bien dans le message — sinon, même si l'e-mail correspond, on demande un
  // contrôle (ex. boîte partagée, transfert interne…).
  const tNom = (tenant?.nomLocataire ?? "").toLowerCase();
  const tPre = (tenant?.prenomLocataire ?? "").toLowerCase();
  const fromLc = (fromName || "").toLowerCase();
  const nameInText = !!tenant && tNom.length >= 2 && tPre.length >= 2 && hints.includes(tNom) && hints.includes(tPre);
  const nameInSender = !!tenant && tNom.length >= 2 && (fromLc.includes(tNom) || fromLc.includes(tPre));
  // Envoi auto autorisé seulement si : e-mail vérifié ET nom présent dans le texte.
  const matched = emailMatch && nameInText;

  // ── EN CAS DE DOUTE : Auguste DEMANDE avant de chercher dans la GED ──
  // Tant que l'agent n'a pas confirmé, si l'identité OU le type de document ne
  // sont pas certains, on renvoie une demande de confirmation SANS lancer la
  // recherche GED.
  const confident = emailMatch && nameInText && !!doc.gedRegex;
  if (!confirmed && !confident) {
    const seen = new Set<string>();
    const candidates = [emailTenant, ...nameCands].filter(Boolean).filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; })
      .map(t => ({ id: t.id as string, name: `${t.prenomLocataire ?? ""} ${t.nomLocataire ?? ""}`.trim() || "—", email: t.email ?? null, owner: t.nomProprietaire ?? null }));
    const reason = !doc.gedRegex
      ? `Le document demandé n'est pas clairement identifié (${doc.label}).`
      : candidates.length === 0
        ? "Je n'ai pas identifié le locataire concerné avec certitude dans le message."
        : candidates.length > 1
          ? "Plusieurs locataires correspondent — précisez lequel."
          : (emailMatch && !nameInText)
            ? "L'e-mail correspond à un locataire, mais son nom n'apparaît pas dans le message (mail transféré ?)."
            : "Je préfère confirmer le locataire avant de chercher dans la GED.";
    return NextResponse.json({
      ok: true,
      needConfirm: true,
      docType: doc.type,
      docLabel: doc.label,
      gedSearchable: !!doc.gedRegex,
      candidates,
      proposedTenantId: tenant?.id ?? null,
      reason,
    });
  }

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
  // Photo d'Auguste (réglage admin auguste_logo_url) pour la signature.
  const logo = await prisma.setting.findUnique({ where: { key: "auguste_logo_url" } }).catch(() => null);
  const replyHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1C1A17;line-height:1.6">
  <p>Bonjour ${escapeHtml(clientName)},</p>
  <p>${intro}</p>
  <p>Nous restons à votre disposition pour toute information complémentaire.</p>
</div>
${augusteSignatureHtml(logo?.value || null)}`.trim();

  // Réglage global : envoi 100 % automatique quand l'expéditeur est reconnu.
  const autoSetting = await prisma.setting.findUnique({ where: { key: "auguste_auto_send_ged" } }).catch(() => null);
  const autoSend = autoSetting?.value === "1";

  // Bilan des CONTRÔLES effectués avant de répondre.
  const controls = {
    email: emailMatch,        // l'e-mail expéditeur = locataire enregistré
    nameInSender,             // le nom du locataire est dans le nom d'expéditeur
    nameInText,               // le nom du locataire est dans le corps/signature
    gedFound: !!attachment,   // le document a été trouvé dans la GED
  };
  // Avertissement de contrôle (raison du blocage de l'envoi auto).
  let warning = "";
  if (mismatch) {
    warning = `Le nom/la signature correspond au locataire ${clientName}, mais l'adresse e-mail expéditrice (${fromEmail || "inconnue"}) n'est PAS celle enregistrée (${tenantEmail || "non renseignée"}). Vérifiez l'identité avant d'envoyer.`;
  } else if (emailMatch && !nameInText) {
    warning = `L'adresse e-mail correspond au locataire ${clientName}, mais son nom n'apparaît pas clairement dans le message (mail transféré ? boîte partagée ?). Vérifiez avant d'envoyer.`;
  } else if (!attachment && tenant) {
    warning = `Aucun document « ${doc.label} » trouvé dans la GED pour ${clientName}. Vérifiez avant de répondre.`;
  }

  return NextResponse.json({
    ok: true,
    isRequest: doc.type !== "autre",
    docType: doc.type,
    docLabel: doc.label,
    matched,            // e-mail + nom dans le texte vérifiés → envoi auto possible
    nameMatch,          // nom/signature = locataire (mais e-mail à vérifier)
    mismatch,           // nom OK mais e-mail différent → contrôle requis
    controls,
    warning,
    contactName: clientName,
    found: !!attachment,
    attachment,
    replyHtml,
    note: gedNote,
    autoSend,           // réglage admin : envoi auto autorisé
    // Envoi auto seulement si TOUS les contrôles passent (e-mail + nom + GED).
    mode: matched && attachment ? "ready" : "review",
  });
}
