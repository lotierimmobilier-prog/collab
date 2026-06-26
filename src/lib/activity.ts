// Libellés lisibles des pages pour le journal d'activité, et formatage du temps.

const PAGE_LABELS: { test: RegExp; label: string }[] = [
  { test: /^\/$/, label: "Tableau de bord" },
  { test: /^\/taches/, label: "Tâches" },
  { test: /^\/planning/, label: "Planning" },
  { test: /^\/messagerie-interne/, label: "Messages internes" },
  { test: /^\/messagerie/, label: "Messagerie email" },
  { test: /^\/appels/, label: "Appels téléphoniques" },
  { test: /^\/annuaire/, label: "Annuaire" },
  { test: /^\/gestion/, label: "Gestion locative" },
  { test: /^\/formation/, label: "Formation" },
  { test: /^\/reseaux-sociaux/, label: "Réseaux sociaux" },
  { test: /^\/direction\/vehicule/, label: "Direction — fiche véhicule" },
  { test: /^\/direction\/local/, label: "Direction — fiche local" },
  { test: /^\/direction/, label: "Direction — gestion d'entreprise" },
  { test: /^\/comptabilite/, label: "Comptabilité" },
  { test: /^\/ics/, label: "Connecteur ICS" },
  { test: /^\/admin\/utilisateurs/, label: "Admin — utilisateurs" },
  { test: /^\/admin\/roles/, label: "Admin — rôles" },
  { test: /^\/admin\/performance/, label: "Admin — performances" },
  { test: /^\/admin\/activite/, label: "Admin — activité" },
  { test: /^\/admin/, label: "Administration" },
];

export function pageLabel(path: string): string {
  const p = (path || "").split("?")[0];
  return PAGE_LABELS.find(x => x.test.test(p))?.label ?? p;
}

/** "2 h 13 min" / "47 min" / "12 s". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h${m > 0 ? ` ${m} min` : ""}`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
