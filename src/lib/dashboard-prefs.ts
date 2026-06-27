// Préférences de tableau de bord par utilisateur (indicateurs + blocs affichés).
// Stockées dans la table Setting (clé `dash_prefs_<userId>`), possédée par l'app.
import { prisma } from "@/lib/prisma";

export interface DashPrefs { kpis?: string[]; blocks?: string[] }

// Catalogue des blocs du tableau de bord.
export const DASH_BLOCKS: { id: string; label: string }[] = [
  { id: "ranking", label: "Classement du trimestre" },
  { id: "mails", label: "Mails" },
  { id: "tasks", label: "Tâches" },
  { id: "agenda", label: "Agenda de la semaine" },
  { id: "calls", label: "Appels" },
  { id: "notes", label: "Notes" },
];
export const DASH_BLOCK_IDS = DASH_BLOCKS.map(b => b.id);

// Catalogue des indicateurs (KPI). `direction` = réservé à la direction.
export const DASH_KPIS: { id: string; label: string; direction?: boolean }[] = [
  { id: "ca_month", label: "CA encaissé du mois", direction: true },
  { id: "ods_open", label: "ODS en cours" },
  { id: "rdv_week", label: "RDV de la semaine" },
  { id: "tasks_open", label: "Tâches en cours" },
  { id: "tasks_done", label: "Tâches terminées (mois)" },
  { id: "mails_unread", label: "Mails non lus" },
];

export function isDirectionRole(role: string): boolean {
  return ["admin", "dirigeant", "direction"].includes(role);
}

// KPI disponibles pour un rôle (la direction voit le CA en plus).
export function availableKpis(role: string) {
  return DASH_KPIS.filter(k => !k.direction || isDirectionRole(role));
}

// Sélection par défaut selon le rôle.
export function defaultKpis(role: string): string[] {
  if (isDirectionRole(role)) return ["ca_month", "ods_open", "tasks_open"];
  if (role === "gestionnaire" || role === "syndic") return ["ods_open", "tasks_open", "mails_unread"];
  if (role === "agent") return ["rdv_week", "tasks_open", "mails_unread"];
  return ["tasks_done", "tasks_open", "mails_unread"];
}

export async function getDashPrefs(uid: string): Promise<DashPrefs> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: `dash_prefs_${uid}` } });
    return s?.value ? JSON.parse(s.value) : {};
  } catch { return {}; }
}

export async function setDashPrefs(uid: string, p: DashPrefs): Promise<void> {
  const key = `dash_prefs_${uid}`;
  const value = JSON.stringify({ kpis: p.kpis, blocks: p.blocks });
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}
