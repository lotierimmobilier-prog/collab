// Catégories de l'annuaire : socle par défaut + catégories ajoutées par l'admin
// (stockées dans Setting.key = "contact_categories", JSON).

export interface ContactCategory { id: string; label: string; color: string; custom?: boolean }

export const DEFAULT_CONTACT_CATEGORIES: ContactCategory[] = [
  { id: "fournisseur",  label: "Fournisseurs",  color: "#0EA5E9" },
  { id: "proprietaire", label: "Propriétaires", color: "#8B5CF6" },
  { id: "locataire",    label: "Locataires",    color: "#10B981" },
  { id: "direction",    label: "Direction",     color: "#B8966A" },
  { id: "commercial",   label: "Commerciaux",   color: "#F59E0B" },
  { id: "tutelle",      label: "Tutelles",      color: "#EF4444" },
  { id: "autre",        label: "Autres",        color: "#6B7280" },
];

export const CONTACT_CATEGORIES_KEY = "contact_categories";

/** Transforme un libellé en identifiant (slug) stable. */
export function slugifyCategory(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")   // enlève les accents
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Fusionne défauts + personnalisées (les défauts d'abord, sans doublon d'id). */
export function mergeCategories(custom: ContactCategory[]): ContactCategory[] {
  const seen = new Set(DEFAULT_CONTACT_CATEGORIES.map(c => c.id));
  const extra = custom.filter(c => c.id && !seen.has(c.id)).map(c => ({ ...c, custom: true }));
  return [...DEFAULT_CONTACT_CATEGORIES, ...extra];
}

/** Roles ayant une vision globale de l'annuaire (voient tous les contacts). */
export function seesAllContacts(roleId?: string | null): boolean {
  return roleId === "admin" || roleId === "gestionnaire" || roleId === "dirigeant" || roleId === "direction";
}
