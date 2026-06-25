export type Priority = "urgent" | "haute" | "moyenne" | "basse";
export type Status = "todo" | "inprogress" | "review" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: Status;
  priority: Priority;
  assignee?: string;
  assigneeId?: string;
  assigneeInitials?: string;
  assigneeColor?: string;
  dueDate?: string;
  completedAt?: string;
  completedById?: string;
  tags?: string[];
  project?: string;
  recurrence?: string;
  subtasks?: { label: string; done: boolean }[];
  comments?: number;
  attachments?: number;
  family?: { id: string; name: string; color: string } | null;
  group?: { id: string; name: string } | null;
}

// Récurrence : une tâche terminée peut réapparaître « à faire » après ce délai.
export const RECURRENCES: { id: string; label: string; days?: number; months?: number }[] = [
  { id: "",          label: "Aucune (non récurrente)" },
  { id: "7d",        label: "Tous les 7 jours",   days: 7 },
  { id: "15d",       label: "Tous les 15 jours",  days: 15 },
  { id: "30d",       label: "Tous les 30 jours",  days: 30 },
  { id: "trimestre", label: "Chaque trimestre",   months: 3 },
  { id: "semestre",  label: "Chaque semestre",    months: 6 },
  { id: "annee",     label: "Chaque année",       months: 12 },
];
export function nextRecurrenceDate(recurrence: string | null | undefined, from: Date = new Date()): Date | null {
  const r = RECURRENCES.find(x => x.id === recurrence);
  if (!r || (!r.days && !r.months)) return null;
  const d = new Date(from);
  if (r.days)   d.setDate(d.getDate() + r.days);
  if (r.months) d.setMonth(d.getMonth() + r.months);
  return d;
}

export const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "todo",       label: "À faire",     color: "#6b7280" },
  { id: "inprogress", label: "En cours",    color: "#f59e0b" },
  { id: "done",       label: "Terminé",     color: "#10b981" },
];

export const PRIORITY_STYLES: Record<Priority, { bg: string; text: string; label: string }> = {
  urgent:  { bg: "#fef2f2", text: "#991b1b", label: "Urgent" },
  haute:   { bg: "#fff7ed", text: "#9a3412", label: "Haute" },
  moyenne: { bg: "#fffbeb", text: "#92400e", label: "Moyenne" },
  basse:   { bg: "#f0fdf4", text: "#166534", label: "Basse" },
};

export const INITIAL_TASKS: Task[] = [];
