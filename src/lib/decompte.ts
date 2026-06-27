// Décompte des heures — calculs partagés (UI + PDF) et listes d'options
// (format légal L.143-14 du Code du travail).

export interface DayEntry {
  d: number;        // jour du mois
  m1?: string; m2?: string; // matin arrivée/départ "HH:MM"
  a1?: string; a2?: string; // après-midi
  s1?: string; s2?: string; // soir
  nuit?: number;    // dont heures de nuit
  panier?: boolean; // panier pris
  obs?: string;     // observation (congé, absence…)
}

export const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

// Observations possibles (reprises du modèle Excel de l'agence).
export const OBS_OPTIONS = [
  "", "congé payé", "congé payé 1/2 jour matin", "congé payé 1/2 jour après-midi",
  "congé sans solde", "récupération", "repos compensateur",
  "férié travaillé", "férié non travaillé", "férié travaillé (journée de solidarité)",
  "absence (autorisée)", "absence (non autorisée)", "arrivé en retard", "parti en avance",
  "maladie avec arrêt", "accident de travail avec arrêt", "accident de trajet avec arrêt",
  "congé maternité", "congé paternité", "école CFA", "activité partielle (chômage partiel)",
];
export const PRIME_MOTIFS = ["", "assiduité", "sur chiffre d'affaire", "à la production", "de noël", "chèque cadeau", "exceptionnelle"];
export const ACOMPTE_MODES = ["", "chèque", "espèce", "virement bancaire"];

function toMin(t?: string): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

function rangeH(a?: string, b?: string): number {
  const x = toMin(a), y = toMin(b);
  if (x == null || y == null || y <= x) return 0;
  return (y - x) / 60;
}

// Total d'heures travaillées d'une journée (matin + après-midi + soir).
export function dayHours(e: DayEntry): number {
  return rangeH(e.m1, e.m2) + rangeH(e.a1, e.a2) + rangeH(e.s1, e.s2);
}

export function round2(n: number): number { return Math.round(n * 100) / 100; }

// Jours du mois "YYYY-MM" avec leur jour de semaine.
export function monthDays(month: string): { d: number; weekday: string; dow: number }[] {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return [];
  const year = Number(m[1]), mo = Number(m[2]);
  const nb = new Date(year, mo, 0).getDate();
  const out: { d: number; weekday: string; dow: number }[] = [];
  for (let d = 1; d <= nb; d++) {
    const dow = new Date(year, mo - 1, d).getDay();
    out.push({ d, weekday: WEEKDAYS[dow], dow });
  }
  return out;
}

export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  return new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

// Totaux : mois + par semaine (semaines découpées comme dans le modèle :
// blocs de 7 jours à partir du 1er).
export function totals(month: string, entries: DayEntry[]) {
  const byDay = new Map(entries.map(e => [e.d, e]));
  const days = monthDays(month);
  let monthTotal = 0, nuitTotal = 0, paniers = 0;
  const weeks: { from: number; to: number; hours: number }[] = [];
  let weekHours = 0, weekFrom = 1, count = 0;
  for (const { d } of days) {
    const e = byDay.get(d);
    const h = e ? dayHours(e) : 0;
    monthTotal += h; weekHours += h;
    if (e?.nuit) nuitTotal += Number(e.nuit) || 0;
    if (e?.panier) paniers++;
    count++;
    if (count === 7 || d === days.length) {
      weeks.push({ from: weekFrom, to: d, hours: round2(weekHours) });
      weekHours = 0; weekFrom = d + 1; count = 0;
    }
  }
  return { monthTotal: round2(monthTotal), nuitTotal: round2(nuitTotal), paniers, weeks };
}
