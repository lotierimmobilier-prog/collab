// Formation par parrainage — utilitaires.

export type VStatus = "todo" | "en_cours" | "termine";

export interface ValidationLike {
  parrainValidated?: boolean;
  filleulValidated?: boolean;
  dates?: unknown;
}

/** Statut d'une compétence pour un filleul : terminée si les DEUX ont validé. */
export function validationStatus(v?: ValidationLike | null): VStatus {
  if (!v) return "todo";
  if (v.parrainValidated && v.filleulValidated) return "termine";
  const hasDates = Array.isArray(v.dates) && v.dates.length > 0;
  if (v.parrainValidated || v.filleulValidated || hasDates) return "en_cours";
  return "todo";
}

export const V_STATUS_LABEL: Record<VStatus, { label: string; color: string }> = {
  todo:     { label: "À faire",   color: "#9ca3af" },
  en_cours: { label: "En cours",  color: "#D97706" },
  termine:  { label: "Validée",   color: "#2F855A" },
};
