// Détection des leads issus des portails immobiliers et préparation de la
// réponse automatique (brouillon) selon le type d'annonce (vente / gestion).

export interface Portal { id: string; label: string; domains: string[] }

export const PORTALS: Portal[] = [
  { id: "leboncoin", label: "Leboncoin",      domains: ["leboncoin.fr"] },
  { id: "bienici",   label: "Bien'ici",       domains: ["bienici.com", "bien-ici.com"] },
  { id: "lefigaro",  label: "Le Figaro Immo", domains: ["figaroimmo.com", "explorimmo.com", "lefigaro.fr", "properties.lefigaro.fr"] },
];

export function portalLabel(id: string): string {
  return PORTALS.find(p => p.id === id)?.label ?? id;
}

// Identifie le portail à partir de l'adresse expéditrice (domaine).
export function detectPortal(fromEmail: string | null | undefined): Portal | null {
  const email = (fromEmail ?? "").toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1);
  return PORTALS.find(p => p.domains.some(d => domain === d || domain.endsWith("." + d))) ?? null;
}

// Normalise une référence pour une comparaison tolérante (casse, espaces, tirets).
const normRef = (s: string) => s.toLowerCase().replace(/[\s\-_./]/g, "");

// Cherche, parmi les références connues d'un portail, celle qui apparaît dans le
// texte du mail (sujet + corps). On retient la plus longue correspondance pour
// éviter les faux positifs sur des références trop courtes.
export function findMatchingReference(text: string, references: string[]): string | null {
  const hay = normRef(text || "");
  let best: string | null = null;
  for (const ref of references) {
    const n = normRef(ref);
    if (n.length >= 4 && hay.includes(n)) {
      if (!best || n.length > normRef(best).length) best = ref;
    }
  }
  return best;
}

// Modèles de réponse (brouillon) signés Auguste, l'assistant IA de l'agence.
export function buildReply(opts: {
  type: string; reference: string; price?: string | null;
  agentName?: string | null; agentPhone?: string | null; zelokLink?: string | null;
}): string {
  const agent = (opts.agentName || "votre conseiller").trim();
  const phone = opts.agentPhone ? ` Vous pouvez aussi le/la joindre directement au ${opts.agentPhone}.` : "";
  const prix = opts.price ? ` au prix de ${opts.price}` : "";

  if (opts.type === "gestion") {
    const lien = opts.zelokLink ? opts.zelokLink : "(lien à compléter)";
    return [
      "Bonjour,",
      "",
      `Merci pour votre intérêt concernant notre bien à la location (réf. ${opts.reference})${prix}.`,
      "",
      "Je suis Auguste, l'assistant virtuel de l'agence Lotier Immobilier.",
      "",
      `Pour étudier votre candidature, merci de constituer votre dossier locataire via ce lien sécurisé : ${lien}`,
      "",
      `Une fois votre dossier complet, ${agent} vous rappellera pour organiser une visite.${phone}`,
      "",
      "À très bientôt,",
      "L'équipe Lotier Immobilier",
    ].join("\n");
  }
  // Vente (par défaut)
  return [
    "Bonjour,",
    "",
    `Merci pour votre intérêt concernant notre annonce (réf. ${opts.reference})${prix}.`,
    "",
    "Je suis Auguste, l'assistant virtuel de l'agence Lotier Immobilier. Vous trouverez ci-joint la fiche complète du bien.",
    "",
    `${agent} reviendra vers vous très rapidement pour répondre à toutes vos questions.${phone}`,
    "",
    "À très bientôt,",
    "L'équipe Lotier Immobilier",
  ].join("\n");
}
