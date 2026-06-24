export type Right = "aucun" | "lecture" | "ecriture" | "admin";

export interface ModuleAccess {
  moduleId: string;
  right: Right;
}

export interface Role {
  id: string;
  label: string;
  color: string;
  description: string;
  modules: ModuleAccess[];
  isSystem?: boolean;
}

export interface User {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  password: string;
  roleId: string;
  active: boolean;
  createdAt: string;
  lastLogin?: string;
  avatar?: string;
  accessOverrides?: ModuleAccess[]; // droits individuels qui surchargent le rôle
}

export function getUserRight(user: User, role: Role | undefined, moduleId: string): Right {
  const override = user.accessOverrides?.find(o => o.moduleId === moduleId);
  if (override) return override.right;
  return role?.modules.find(m => m.moduleId === moduleId)?.right ?? "aucun";
}

export const MODULES = [
  { id: "dashboard",   label: "Tableau de bord",    icon: "⊞" },
  { id: "tasks",       label: "Tâches",              icon: "☑" },
  { id: "planning",    label: "Planning",            icon: "📅" },
  { id: "mail",        label: "Messagerie",          icon: "✉" },
  { id: "edl",         label: "États des lieux",     icon: "🏠" },
  { id: "locataires",  label: "Dossiers locataires", icon: "👥" },
  { id: "compta",      label: "Comptabilité",        icon: "💰" },
  { id: "formation",   label: "Formation",           icon: "🎓" },
  { id: "reseaux",     label: "Réseaux sociaux",     icon: "📱" },
  { id: "admin",       label: "Administration",      icon: "⚙" },
];

export const RIGHTS: { value: Right; label: string; color: string; bg: string }[] = [
  { value: "aucun",    label: "Aucun",    color: "#9ca3af", bg: "#f3f4f6" },
  { value: "lecture",  label: "Lecture",  color: "#1e40af", bg: "#eff6ff" },
  { value: "ecriture", label: "Écriture", color: "#92400e", bg: "#fffbeb" },
  { value: "admin",    label: "Admin",    color: "#166534", bg: "#f0fdf4" },
];

const allModules = (right: Right): ModuleAccess[] =>
  MODULES.map(m => ({ moduleId: m.id, right }));

export const DEFAULT_ROLES: Role[] = [
  {
    id: "admin",
    label: "Administrateur",
    color: "#B8966A",
    description: "Accès complet à tous les modules et à l'administration",
    isSystem: true,
    modules: allModules("admin"),
  },
  {
    id: "gestionnaire",
    label: "Gestionnaire",
    color: "#059669",
    description: "Accès complet au module Gestion locative (propriétaires, biens, baux, locataires)",
    modules: MODULES.map(m => ({
      moduleId: m.id,
      right: (["dashboard", "tasks", "planning", "gestion", "fournisseurs", "ods", "mail", "chat"].includes(m.id)) ? "ecriture" : "aucun",
    })),
  },
  {
    id: "syndic",
    label: "Syndic",
    color: "#2563eb",
    description: "Accès au module Syndic (copropriétés, assemblées, charges, travaux)",
    modules: MODULES.map(m => ({
      moduleId: m.id,
      right: (["dashboard", "tasks", "planning", "syndic", "fournisseurs", "ods", "mail", "chat"].includes(m.id)) ? "ecriture" : "aucun",
    })),
  },
  {
    id: "dirigeant",
    label: "Dirigeant",
    color: "#7C3AED",
    description: "Accès complet à tous les modules, vision globale de l'entreprise",
    modules: allModules("admin"),
  },
  {
    id: "agent",
    label: "Agent commercial",
    color: "#059669",
    description: "Accès limité : tâches, planning, EDL et dossiers locataires",
    modules: MODULES.map(m => ({
      moduleId: m.id,
      right: (["dashboard", "tasks", "planning", "edl", "locataires"].includes(m.id)) ? "ecriture" : "aucun",
    })),
  },
];

export function getRightStyle(right: Right) {
  return RIGHTS.find(r => r.value === right) ?? RIGHTS[0];
}

export function canAccess(role: Role, moduleId: string, minRight: Right = "lecture"): boolean {
  const order: Right[] = ["aucun", "lecture", "ecriture", "admin"];
  const moduleAccess = role.modules.find(m => m.moduleId === moduleId);
  if (!moduleAccess) return false;
  return order.indexOf(moduleAccess.right) >= order.indexOf(minRight);
}

export function getInitials(prenom: string, nom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

export const AVATAR_COLORS = [
  { bg: "#F7F0E6", text: "#B8966A" },
  { bg: "#dcfce7", text: "#16a34a" },
  { bg: "#dbeafe", text: "#2563eb" },
  { bg: "#fef9c3", text: "#ca8a04" },
  { bg: "#fce7f3", text: "#db2777" },
  { bg: "#ffedd5", text: "#ea580c" },
];

export function avatarColor(id: string) {
  const idx = id.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
