// Module Direction (gestion d'entreprise) : accès et configuration des ressources.

/** Rôles ayant accès au module Direction (gestion d'entreprise). */
export function isDirection(roleId?: string | null): boolean {
  return roleId === "admin" || roleId === "direction" || roleId === "dirigeant";
}

export interface ResourceConfig {
  /** Champs texte autorisés en écriture. */
  strings: string[];
  /** Champs date (ISO) autorisés. */
  dates: string[];
  /** Champs numériques autorisés. */
  numbers: string[];
  /** Champ obligatoire à la création. */
  required: string;
}

export const RESOURCES: Record<string, ResourceConfig> = {
  vehicles: {
    strings: ["label", "immatriculation", "holdType", "assignedToId", "assignedName", "insurer", "note"],
    dates:   ["startDate", "endDate", "controleTechnique"],
    numbers: ["monthlyCost"],
    required: "label",
  },
  premises: {
    strings: ["label", "address", "bailleur", "note"],
    dates:   ["startDate", "endDate"],
    numbers: ["rentMonthly", "charges"],
    required: "label",
  },
  procards: {
    strings: ["userId", "holderName", "cardNumber", "cardType", "issuedBy", "note"],
    dates:   ["startDate", "expiryDate"],
    numbers: [],
    required: "holderName",
  },
  insurance: {
    strings: ["type", "insurer", "policyNumber", "note"],
    dates:   ["startDate", "endDate"],
    numbers: ["premiumAmount"],
    required: "type",
  },
};
