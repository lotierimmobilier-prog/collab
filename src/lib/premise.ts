// Fiche locale détaillée : documents, sinistres, contrôles de sécurité.

export interface PremiseDoc { id: string; category: string; name: string; mime?: string; size: number; data: string; uploadedAt: string }
export interface PremiseSinistre { id: string; date: string; type: string; declared: boolean; description?: string }
export interface SecurityControl { id: string; type: string; date?: string; nextDate?: string; status: string; note?: string }

export const DOC_CATEGORIES: { id: string; label: string }[] = [
  { id: "assurance",  label: "Assurance" },
  { id: "bail",       label: "Bail" },
  { id: "diagnostic", label: "Diagnostic (DPE, électricité, amiante…)" },
  { id: "autre",      label: "Autre" },
];
export const docCategoryLabel = (id: string) => DOC_CATEGORIES.find(c => c.id === id)?.label ?? id;

export const PREMISE_SINISTRE_TYPES: { id: string; label: string }[] = [
  { id: "degat_eaux",  label: "Dégât des eaux" },
  { id: "incendie",    label: "Incendie" },
  { id: "vol",         label: "Vol / cambriolage" },
  { id: "vandalisme",  label: "Vandalisme" },
  { id: "bris_glace",  label: "Bris de glace" },
  { id: "autre",       label: "Autre" },
];
export const premiseSinistreLabel = (id: string) => PREMISE_SINISTRE_TYPES.find(t => t.id === id)?.label ?? id;

export const CONTROL_TYPES: { id: string; label: string }[] = [
  { id: "extincteurs",    label: "Extincteurs" },
  { id: "electricite",    label: "Installation électrique" },
  { id: "alarme",         label: "Alarme / intrusion" },
  { id: "incendie",       label: "Sécurité incendie (SSI, désenfumage)" },
  { id: "ascenseur",      label: "Ascenseur" },
  { id: "gaz",            label: "Gaz / chauffage" },
  { id: "climatisation",  label: "Climatisation" },
  { id: "accessibilite",  label: "Accessibilité (ERP)" },
  { id: "autre",          label: "Autre" },
];
export const controlTypeLabel = (id: string) => CONTROL_TYPES.find(t => t.id === id)?.label ?? id;

export const CONTROL_STATUS: { id: string; label: string; tone: "ok" | "warn" | "bad" }[] = [
  { id: "conforme",     label: "Conforme",      tone: "ok" },
  { id: "a_prevoir",    label: "À prévoir",     tone: "warn" },
  { id: "non_conforme", label: "Non conforme",  tone: "bad" },
];
export const controlStatusMeta = (id: string) => CONTROL_STATUS.find(s => s.id === id);

export const MAX_PREMISE_DOCS_BYTES = 25 * 1024 * 1024; // 25 Mo cumulés
