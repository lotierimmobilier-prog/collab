export type TransactionType = "vente" | "location";
export type FactureStatus = "brouillon" | "emise" | "payee" | "annulee";
export type EncaissementType = "honoraires_vente" | "honoraires_location" | "gestion_locative" | "autre";

export interface Mandataire {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  siret?: string;
  tauxCommission: number; // % des honoraires agence reversé au mandataire
  actif: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  reference: string;
  bien: string;
  adresse?: string;
  client: string;
  mandataireId?: string;
  // Vente
  prixVente?: number;
  honorairesAgenceHT?: number;
  // Location
  loyerCC?: number;
  honorairesLocationHT?: number;
  // Commun
  dateTransaction: string;
  encaisse: boolean;
  encaissementId?: string;
  factureId?: string;
  notes?: string;
}

export interface Encaissement {
  id: string;
  transactionId?: string;
  libelle: string;
  type: EncaissementType;
  montantHT: number;
  tva: number; // taux en %
  montantTTC: number;
  date: string;
  mode: "virement" | "cheque" | "especes" | "autre";
  reference?: string;
  notes?: string;
}

export interface Facture {
  id: string;
  numero: string;
  transactionId: string;
  mandataireId: string;
  // Montants
  honorairesAgenceHT: number;
  tauxCommission: number;
  commissionHT: number;
  tva: number;
  commissionTTC: number;
  // Statut
  status: FactureStatus;
  dateEmission: string;
  datePaiement?: string;
  notes?: string;
}

export const TVA_TAUX = 20;

export const ENCAISSEMENT_LABELS: Record<EncaissementType, string> = {
  honoraires_vente: "Honoraires vente",
  honoraires_location: "Honoraires mise en location",
  gestion_locative: "Gestion locative",
  autre: "Autre",
};

export const FACTURE_STATUS: Record<FactureStatus, { label: string; bg: string; text: string }> = {
  brouillon: { label: "Brouillon",  bg: "#f3f4f6", text: "#6b7280" },
  emise:     { label: "Émise",      bg: "#eff6ff", text: "#1e40af" },
  payee:     { label: "Payée",      bg: "#f0fdf4", text: "#166534" },
  annulee:   { label: "Annulée",    bg: "#fef2f2", text: "#991b1b" },
};

export const TRANSACTION_TYPE: Record<TransactionType, { label: string; icon: string; color: string }> = {
  vente:    { label: "Vente",          icon: "🏡", color: "#7c3aed" },
  location: { label: "Mise en location", icon: "🔑", color: "#0891b2" },
};

export function calcCommission(honorairesHT: number, tauxCommission: number): {
  commissionHT: number; tva: number; commissionTTC: number;
} {
  const commissionHT = Math.round((honorairesHT * tauxCommission) / 100 * 100) / 100;
  const tva = Math.round(commissionHT * TVA_TAUX) / 100;
  const commissionTTC = Math.round((commissionHT + tva) * 100) / 100;
  return { commissionHT, tva, commissionTTC };
}

export function genNumeroFacture(existing: Facture[]): string {
  const year = new Date().getFullYear();
  const count = existing.filter(f => f.numero.startsWith(`FAC-${year}`)).length + 1;
  return `FAC-${year}-${String(count).padStart(4, "0")}`;
}

export function formatEur(n: number): string {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
