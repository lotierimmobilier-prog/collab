// Comptabilité — banque & trésorerie. Constantes partagées API / UI.

export type Service = "vente" | "gestion" | "syndic" | "agence";

export const SERVICES: { id: Service; label: string; color: string }[] = [
  { id: "vente",   label: "Vente",   color: "#DC2626" },
  { id: "gestion", label: "Gestion", color: "#2563EB" },
  { id: "syndic",  label: "Syndic",  color: "#7C3AED" },
  { id: "agence",  label: "Agence",  color: "#B8966A" },
];

export const SERVICE_IDS = SERVICES.map(s => s.id);
export const serviceMeta = (id?: string | null) => SERVICES.find(s => s.id === id);

// Comptes de trésorerie. La séparation gestion/syndic est une obligation légale :
// les fonds mandants ne se mélangent jamais.
export type AccountKind = "gestion" | "syndic" | "agence";
export const ACCOUNT_KINDS: { id: AccountKind; label: string; color: string }[] = [
  { id: "gestion", label: "Gestion (fonds mandants)", color: "#2563EB" },
  { id: "syndic",  label: "Syndic (fonds mandants)",  color: "#7C3AED" },
  { id: "agence",  label: "Agence",                   color: "#B8966A" },
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
