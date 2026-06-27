import { prisma } from "@/lib/prisma";

// ── Mails types (modèles d'emails) ─────────────────────────────────
// Modèles pré-remplis, éditables dans l'admin. Stockés en base (table
// settings, clé « mailtpl_<id> ») au format JSON { subject, body }.
// Le rendu remplace les variables {{xxx}} ; toute LIGNE contenant une
// variable laissée vide est retirée (permet des lignes optionnelles).

export interface MailTemplate {
  id: string;
  label: string;
  description: string;
  subject: string;
  body: string;
  /** Variables disponibles (pour l'aide à la saisie). */
  variables: { name: string; hint: string }[];
}

export const DEFAULT_TEMPLATES: MailTemplate[] = [
  {
    id: "ods_supplier",
    label: "Ordre de service — envoi au fournisseur",
    description: "Email envoyé au fournisseur avec le détail de l'intervention et le lien de son portail.",
    subject: "[{{ref}}] {{type_titre}}",
    body: `Bonjour,

Nous vous confions l'intervention suivante (réf. {{ref}}) :

• Type : {{type}}
• Objet : {{titre}}
• Description : {{description}}
• Lieu : {{lieu}}
• {{urgence}}
• Délai souhaité : {{delai}}

Contact sur place {{contact_role}} : {{contact}}
{{cle_agence}}
Infos d'accès : {{acces}}

{{devis}}
La facture est à adresser à l'agence ({{agence_email}}).

➡ Suivez cette intervention, déposez votre devis / facture / photos et échangez avec nous ici :
{{portail}}

{{pieces}}
Pour toute question : {{agent}}.

Cordialement,
{{agence_nom}}`,
    variables: [
      { name: "ref", hint: "Référence ODS (ODS-2026-001)" },
      { name: "type_titre", hint: "Type + objet (objet de l'email)" },
      { name: "type", hint: "Type d'intervention" },
      { name: "titre", hint: "Objet de l'intervention" },
      { name: "description", hint: "Description détaillée" },
      { name: "lieu", hint: "Adresse de l'intervention" },
      { name: "urgence", hint: "« ⚠ URGENT » si urgent" },
      { name: "delai", hint: "Date limite souhaitée" },
      { name: "contact_role", hint: "(Locataire / Copropriétaire…)" },
      { name: "contact", hint: "Nom — téléphone du contact sur place" },
      { name: "cle_agence", hint: "Mention clés à l'agence" },
      { name: "acces", hint: "Digicode, étage, instructions" },
      { name: "devis", hint: "Demande de devis ou montant convenu" },
      { name: "agence_email", hint: "Email de l'agence (facture)" },
      { name: "portail", hint: "Lien du portail fournisseur" },
      { name: "pieces", hint: "Liste des pièces jointes" },
      { name: "agent", hint: "Agent référent + téléphone" },
      { name: "agence_nom", hint: "Nom de l'agence (signature)" },
    ],
  },
  {
    id: "assistance_tenant",
    label: "Assistance locataire — lien sinistre",
    description: "Email/SMS au locataire pour déclarer un sinistre (photos + remarques).",
    subject: "Votre déclaration — {{agence_nom}}",
    body: `Bonjour,

Suite à votre appel concernant {{objet}}, merci de nous transmettre les détails et photos via ce lien sécurisé :
{{lien}}

Cela nous permettra de mandater rapidement le bon intervenant.

Cordialement,
{{agent}}
{{agence_nom}}`,
    variables: [
      { name: "objet", hint: "Motif (fuite, panne…)" },
      { name: "lien", hint: "Lien de déclaration" },
      { name: "agent", hint: "Agent référent" },
      { name: "agence_nom", hint: "Nom de l'agence" },
    ],
  },
  {
    id: "visio",
    label: "Visio — invitation",
    description: "Email invitant à lancer une visio depuis son téléphone (constat en direct).",
    subject: "Visio en direct — {{agence_nom}}",
    body: `Bonjour,

Pour nous montrer la situation en direct, cliquez sur ce lien depuis votre téléphone (autorisez la caméra) :
{{lien}}

Aucune installation nécessaire.

Cordialement,
{{agent}}
{{agence_nom}}`,
    variables: [
      { name: "lien", hint: "Lien de la visio" },
      { name: "agent", hint: "Agent référent" },
      { name: "agence_nom", hint: "Nom de l'agence" },
    ],
  },
  {
    id: "supplier_conformite",
    label: "Fournisseur — demande de justificatifs (assurance / URSSAF)",
    description: "Relance envoyée au fournisseur pour qu'il dépose son assurance et son attestation URSSAF à jour.",
    subject: "Vos justificatifs à jour — {{agence_nom}}",
    body: `Bonjour,

Pour continuer à vous confier des interventions, nous devons disposer de vos justificatifs à jour :
{{manquants}}

Merci de les déposer en quelques clics via votre espace sécurisé :
{{lien}}

Vous pouvez aussi simplement répondre à cet email en joignant vos attestations.

Cordialement,
{{agence_nom}}`,
    variables: [
      { name: "manquants", hint: "Liste des documents à fournir/renouveler" },
      { name: "lien", hint: "Lien de l'espace fournisseur" },
      { name: "agence_nom", hint: "Nom de l'agence" },
    ],
  },
  {
    id: "hours_reminder_collab",
    label: "Décompte des heures — relance collaborateur (le 25)",
    description: "Envoyé le 25 de chaque mois à chaque collaborateur salarié pour qu'il complète et signe son décompte des heures.",
    subject: "Votre décompte des heures de {{mois}} à compléter et signer",
    body: `Bonjour,

Merci de compléter et de signer votre décompte des heures du mois de {{mois}}, directement dans votre espace :
{{lien}}

Pourquoi ce document ? Le Code du travail impose un document mensuel, signé par le salarié et l'employeur, annexé au bulletin de paie. Il récapitule vos heures de travail (quotidiennement par heures de début/fin, et par semaine). Votre signature et celle de l'employeur le rendent valable ; il nous protège tous deux en cas de litige (ex. réclamation d'heures supplémentaires).

Une fois signé de votre côté, la direction le validera et le transmettra au cabinet comptable pour l'établissement de votre bulletin de salaire.

Cordialement,
{{agence_nom}}`,
    variables: [
      { name: "mois", hint: "Mois concerné (ex. juin 2026)" },
      { name: "lien", hint: "Lien vers le décompte à remplir/signer" },
      { name: "agence_nom", hint: "Nom de l'agence" },
    ],
  },
  {
    id: "hours_accountant",
    label: "Décompte des heures — envoi au comptable (après signatures)",
    description: "Envoyé automatiquement au cabinet comptable une fois le décompte signé par le salarié ET l'employeur, avec le PDF en pièce jointe.",
    subject: "Décompte des heures signé — {{employe}} — {{mois}}",
    body: `Bonjour,

Veuillez trouver ci-joint le décompte des heures de {{employe}} pour le mois de {{mois}}, signé par le salarié et l'employeur, pour l'établissement du bulletin de salaire.

Ce document mensuel signé des deux parties est annexé au bulletin de paie conformément au Code du travail.

Lien de téléchargement : {{lien}}

Cordialement,
{{agence_nom}}`,
    variables: [
      { name: "employe", hint: "Nom du salarié" },
      { name: "mois", hint: "Mois concerné" },
      { name: "lien", hint: "Lien de téléchargement du décompte" },
      { name: "agence_nom", hint: "Nom de l'agence" },
    ],
  },
];

export function defaultTemplate(id: string): MailTemplate | undefined {
  return DEFAULT_TEMPLATES.find(t => t.id === id);
}

// Récupère un modèle (version enregistrée si elle existe, sinon défaut).
export async function getTemplate(id: string): Promise<{ subject: string; body: string } | null> {
  const def = defaultTemplate(id);
  try {
    const row = await prisma.setting.findUnique({ where: { key: `mailtpl_${id}` } });
    if (row?.value) {
      const saved = JSON.parse(row.value) as { subject?: string; body?: string };
      return { subject: saved.subject ?? def?.subject ?? "", body: saved.body ?? def?.body ?? "" };
    }
  } catch { /* table absente → défaut */ }
  return def ? { subject: def.subject, body: def.body } : null;
}

// Rendu : remplace {{var}} ; retire les lignes dont une variable est vide.
export function renderTemplate(tpl: { subject: string; body: string }, vars: Record<string, string | null | undefined>): { subject: string; body: string } {
  const val = (k: string) => (vars[k] ?? "").toString().trim();

  const subject = tpl.subject.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => val(k));

  const lines = tpl.body.split("\n").filter(line => {
    const refs = [...line.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]);
    // On retire une ligne dès qu'elle contient au moins une variable ET que
    // TOUTES ses variables sont vides (lignes optionnelles « Libellé : {{x}} »).
    if (refs.length === 0) return true;
    return !refs.every(r => !val(r));
  });

  const body = lines.join("\n").replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => val(k))
    .replace(/\n{3,}/g, "\n\n").trim();

  return { subject, body };
}
