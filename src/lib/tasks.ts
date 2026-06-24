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
  tags?: string[];
  project?: string;
  subtasks?: { label: string; done: boolean }[];
  comments?: number;
  attachments?: number;
  family?: { id: string; name: string; color: string } | null;
  group?: { id: string; name: string } | null;
}

export const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: "todo",       label: "À faire",     color: "#6b7280" },
  { id: "inprogress", label: "En cours",    color: "#f59e0b" },
  { id: "review",     label: "En révision", color: "#B8966A" },
  { id: "done",       label: "Terminé",     color: "#10b981" },
];

export const PRIORITY_STYLES: Record<Priority, { bg: string; text: string; label: string }> = {
  urgent:  { bg: "#fef2f2", text: "#991b1b", label: "Urgent" },
  haute:   { bg: "#fff7ed", text: "#9a3412", label: "Haute" },
  moyenne: { bg: "#fffbeb", text: "#92400e", label: "Moyenne" },
  basse:   { bg: "#f0fdf4", text: "#166534", label: "Basse" },
};

export const INITIAL_TASKS: Task[] = [];
