// Performances commerciales — types d'opérations et utilitaires de trimestre.

export type PerfType = "vente" | "mandat_vente" | "mandat_loc" | "mise_en_loc";

export const PERF_TYPES: { id: PerfType; label: string; short: string; color: string; icon: string }[] = [
  { id: "vente",        label: "Ventes",              short: "Vente",       color: "#DC2626", icon: "🏠" },
  { id: "mandat_vente", label: "Mandats de vente",    short: "Mandat vente", color: "#D97706", icon: "📝" },
  { id: "mandat_loc",   label: "Mandats de location", short: "Mandat loc",  color: "#2563EB", icon: "🔑" },
  { id: "mise_en_loc",  label: "Mises en location",   short: "Mise en loc", color: "#059669", icon: "📍" },
];

// Typé string[] (et non PerfType[]) pour que .includes(maStringQuelconque)
// soit accepté en mode strict lors des validations.
export const PERF_TYPE_IDS: string[] = PERF_TYPES.map(t => t.id);

export function perfTypeMeta(id: string) {
  return PERF_TYPES.find(t => t.id === id);
}

/** Trimestre (1-4) d'une date. */
export function quarterOf(d: Date): number {
  return Math.floor(d.getMonth() / 3) + 1;
}

/** Clé canonique d'un trimestre, ex. "2026-T2". */
export function quarterKey(d: Date): string {
  return `${d.getFullYear()}-T${quarterOf(d)}`;
}

export function quarterLabel(year: number, q: number): string {
  return `T${q} ${year}`;
}

/** Bornes [début, fin[ du trimestre contenant `ref` (par défaut maintenant). */
export function quarterBounds(ref: Date = new Date()): { start: Date; end: Date; year: number; quarter: number } {
  const year = ref.getFullYear();
  const quarter = quarterOf(ref);
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const end = new Date(year, startMonth + 3, 1, 0, 0, 0, 0);
  return { start, end, year, quarter };
}

/** Bornes du trimestre à partir d'une clé "2026-T2". */
export function quarterBoundsFromKey(key: string): { start: Date; end: Date; year: number; quarter: number } | null {
  const m = /^(\d{4})-T([1-4])$/.exec(key);
  if (!m) return null;
  const year = parseInt(m[1]);
  const quarter = parseInt(m[2]);
  const startMonth = (quarter - 1) * 3;
  return { start: new Date(year, startMonth, 1), end: new Date(year, startMonth + 3, 1), year, quarter };
}
