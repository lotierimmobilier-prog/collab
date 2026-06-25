// Comptabilité — banque & trésorerie. Constantes partagées API / UI.

export type Service = "vente" | "gestion" | "syndic" | "agence";

// Palette sobre, identité agence : déclinaison de bruns/or + charbon.
export const SERVICES: { id: Service; label: string; color: string }[] = [
  { id: "vente",   label: "Vente",   color: "#1C1A17" },
  { id: "gestion", label: "Gestion", color: "#B8966A" },
  { id: "syndic",  label: "Syndic",  color: "#8A6D44" },
  { id: "agence",  label: "Agence",  color: "#A0907A" },
];

export const SERVICE_IDS = SERVICES.map(s => s.id);
export const serviceMeta = (id?: string | null) => SERVICES.find(s => s.id === id);

// Comptes de trésorerie. La séparation gestion/syndic est une obligation légale :
// les fonds mandants ne se mélangent jamais.
export type AccountKind = "gestion" | "syndic" | "agence";
export const ACCOUNT_KINDS: { id: AccountKind; label: string; color: string }[] = [
  { id: "gestion", label: "Gestion (fonds mandants)", color: "#B8966A" },
  { id: "syndic",  label: "Syndic (fonds mandants)",  color: "#8A6D44" },
  { id: "agence",  label: "Agence",                   color: "#1C1A17" },
];
export const accountKindMeta = (id?: string | null) => ACCOUNT_KINDS.find(k => k.id === id);

/** Rôles ayant accès à la comptabilité. */
export function canAccessCompta(roleId?: string | null): boolean {
  return roleId === "admin" || roleId === "direction" || roleId === "dirigeant";
}

/** Normalise un libellé bancaire pour la mémoire (retire dates, montants, refs). */
export function normalizeLabel(label: string): string {
  return label
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\d{2}[\/.-]\d{2}([\/.-]\d{2,4})?/g, " ")  // dates
    .replace(/\b\d[\d ]{4,}\b/g, " ")                    // longues séquences de chiffres
    .replace(/[^A-Z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function fmtEuro(n: number): string {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}
