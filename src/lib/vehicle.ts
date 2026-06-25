// Fiche véhicule détaillée : documents, suivi kilométrique, sinistres.

export interface VehicleDoc { name: string; mime?: string; size: number; data: string; uploadedAt: string }
export interface KmReading { date: string; km: number }
export interface Sinistre { id: string; date: string; type: string; declared: boolean; description?: string }

export type DocSlot = "assurance" | "carteGrise" | "permis";

export const DOC_SLOTS: { id: DocSlot; label: string }[] = [
  { id: "assurance",  label: "Attestation d'assurance" },
  { id: "carteGrise", label: "Carte grise" },
  { id: "permis",     label: "Permis du conducteur" },
];

export const SINISTRE_TYPES: { id: string; label: string }[] = [
  { id: "accident",    label: "Accident" },
  { id: "bris_glace",  label: "Bris de glace" },
  { id: "vol",         label: "Vol" },
  { id: "incendie",    label: "Incendie" },
  { id: "vandalisme",  label: "Vandalisme" },
  { id: "autre",       label: "Autre" },
];
export const sinistreTypeLabel = (id: string) => SINISTRE_TYPES.find(t => t.id === id)?.label ?? id;

export const MAX_VEHICLE_DOCS_BYTES = 20 * 1024 * 1024; // 20 Mo cumulés
