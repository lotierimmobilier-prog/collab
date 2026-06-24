export type DossierStatus = "incomplet" | "complet" | "en_etude" | "valide" | "refuse";

export interface DocItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
  multiple?: boolean;
  group: string;
  accept: string;
  condition?: string;
}

export interface UploadedFile {
  docId: string;
  files: { name: string; size: number; dataUrl: string; type: string }[];
}

export interface Dossier {
  id: string;
  token: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  bien: string;
  loyerCC: number;
  revenus: number;
  typeContrat: string;
  employeur?: string;
  situationLogement: "locataire" | "proprietaire" | "heberge" | "autre";
  status: DossierStatus;
  uploads: UploadedFile[];
  createdAt: string;
  notes?: string;
}

export const DOCUMENT_LIST: DocItem[] = [
  // Identité
  {
    id: "cni_recto",
    label: "Carte d'identité (recto)",
    description: "Recto de votre CNI ou passeport en cours de validité",
    required: true,
    group: "Identité",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  {
    id: "cni_verso",
    label: "Carte d'identité (verso)",
    description: "Verso de votre CNI (passeport : page 2)",
    required: true,
    group: "Identité",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  // Revenus
  {
    id: "fiche_paie_1",
    label: "Fiche de paie M-1",
    description: "Dernier bulletin de salaire",
    required: true,
    group: "Revenus",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  {
    id: "fiche_paie_2",
    label: "Fiche de paie M-2",
    description: "Avant-dernier bulletin de salaire",
    required: true,
    group: "Revenus",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  {
    id: "fiche_paie_3",
    label: "Fiche de paie M-3",
    description: "3ème bulletin de salaire",
    required: true,
    group: "Revenus",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  {
    id: "avis_imposition_n",
    label: "Avis d'imposition N",
    description: "Dernier avis d'imposition",
    required: true,
    group: "Revenus",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  {
    id: "avis_imposition_n1",
    label: "Avis d'imposition N-1",
    description: "Avant-dernier avis d'imposition",
    required: true,
    group: "Revenus",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  {
    id: "simulation_caf",
    label: "Simulation CAF des aides",
    description: "Simulation des aides au logement (APL) disponible sur caf.fr",
    required: false,
    group: "Revenus",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  // Emploi
  {
    id: "contrat_travail",
    label: "Contrat de travail",
    description: "CDI, CDD, ou attestation employeur en cours de validité",
    required: true,
    group: "Emploi",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  // Domicile actuel
  {
    id: "justif_domicile",
    label: "Justificatif de domicile actuel",
    description: "Facture (eau, électricité, internet) de moins de 3 mois",
    required: true,
    group: "Domicile actuel",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  {
    id: "quittances",
    label: "3 dernières quittances de loyer",
    description: "Si vous êtes actuellement locataire",
    required: false,
    multiple: true,
    group: "Domicile actuel",
    accept: ".pdf,.jpg,.jpeg,.png",
    condition: "locataire",
  },
  {
    id: "taxe_fonciere_n",
    label: "Taxe foncière N",
    description: "Si vous êtes propriétaire de votre résidence actuelle",
    required: false,
    group: "Domicile actuel",
    accept: ".pdf,.jpg,.jpeg,.png",
    condition: "proprietaire",
  },
  {
    id: "taxe_fonciere_n1",
    label: "Taxe foncière N-1",
    description: "Si vous êtes propriétaire de votre résidence actuelle",
    required: false,
    group: "Domicile actuel",
    accept: ".pdf,.jpg,.jpeg,.png",
    condition: "proprietaire",
  },
  // Hébergé par un proche
  {
    id: "hebergeur_cni",
    label: "Carte d'identité de l'hébergeant",
    description: "Si vous êtes hébergé à titre gratuit par un proche",
    required: false,
    group: "Hébergement par un proche",
    accept: ".pdf,.jpg,.jpeg,.png",
    condition: "heberge",
  },
  {
    id: "attestation_hebergement",
    label: "Courrier d'attestation d'hébergement",
    description: "Lettre manuscrite ou dactylographiée signée par l'hébergeant",
    required: false,
    group: "Hébergement par un proche",
    accept: ".pdf,.jpg,.jpeg,.png",
    condition: "heberge",
  },
  // Divers
  {
    id: "divers",
    label: "Documents divers",
    description: "Tout autre document utile à l'étude de votre dossier",
    required: false,
    multiple: true,
    group: "Divers",
    accept: ".pdf,.jpg,.jpeg,.png",
  },
];

export const SITUATION_LABELS: Record<string, string> = {
  locataire: "Locataire",
  proprietaire: "Propriétaire",
  heberge: "Hébergé par un proche",
  autre: "Autre",
};

export const STATUS_STYLES: Record<DossierStatus, { label: string; bg: string; text: string }> = {
  incomplet:  { label: "Incomplet",  bg: "#fef2f2", text: "#991b1b" },
  complet:    { label: "Complet",    bg: "#fffbeb", text: "#92400e" },
  en_etude:   { label: "En étude",   bg: "#eff6ff", text: "#1e40af" },
  valide:     { label: "Validé GLI", bg: "#f0fdf4", text: "#166534" },
  refuse:     { label: "Refusé",     bg: "#fef2f2", text: "#991b1b" },
};

export function calcTauxEndettement(loyerCC: number, revenus: number): number {
  if (!revenus) return 0;
  return Math.round((loyerCC / revenus) * 100 * 10) / 10;
}

export function gliEligible(taux: number, revenus: number, loyerCC: number) {
  if (taux === 0) return { ok: false, msg: "Revenus non renseignés" };
  if (taux > 33) return { ok: false, msg: `Taux d'endettement trop élevé (${taux}% > 33%)` };
  if (revenus < loyerCC * 3) return { ok: false, msg: `Revenus insuffisants (minimum ${(loyerCC * 3).toLocaleString("fr-FR")} € requis)` };
  return { ok: true, msg: `Éligible GLI — taux d'endettement ${taux}%` };
}

export function getRequiredDocs(situation: string, docs: DocItem[]): DocItem[] {
  return docs.filter(d => {
    if (!d.required && d.condition && d.condition !== situation) return false;
    if (d.condition && d.condition !== situation) return false;
    return true;
  });
}

export function dossierCompletion(uploads: UploadedFile[], situation: string): number {
  const required = DOCUMENT_LIST.filter(d => d.required);
  if (!required.length) return 0;
  const provided = required.filter(d => uploads.find(u => u.docId === d.id && u.files.length > 0));
  return Math.round((provided.length / required.length) * 100);
}
