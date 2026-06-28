// Gouvernance du Drive agent : dossiers imposés, dossiers communs (super admin)
// poussés sur tous les drives, et visibilité par dossier.
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/superadmin";

// Niveaux de visibilité d'un dossier (qui peut voir son contenu).
export const VISIBILITY = ["confidentiel", "gestionnaire", "direction", "tous"] as const;
export type Visibility = (typeof VISIBILITY)[number];
export const VISIBILITY_LABEL: Record<string, string> = {
  confidentiel: "Confidentiel (moi seul)",
  gestionnaire: "Gestionnaires",
  direction: "Direction",
  tous: "Toute l'agence",
};

// Dossiers imposés sur chaque drive (non renommables / non supprimables).
export interface DefaultFolder { key: string; name: string; readonly?: boolean; visibility?: Visibility }
export const DEFAULT_FOLDERS: DefaultFolder[] = [
  { key: "mandats",      name: "Mandats" },
  { key: "compromis",    name: "Compromis & promesses de vente" },
  { key: "estimations",  name: "Estimations / avis de valeur" },
  { key: "clients",      name: "Clients (vendeurs & acquéreurs)" },
  { key: "locations",    name: "Locations & baux" },
  { key: "diagnostics",  name: "Diagnostics / DPE" },
  { key: "photos",       name: "Photos & visites" },
  { key: "administratif", name: "Mes documents administratifs" },
  { key: "modeles",      name: "Modèles & ressources agence", readonly: true, visibility: "tous" },
  { key: "formation",    name: "Formation" },
];

// Une session impersonée n'est jamais super admin (cf. cloisonnement mail).
export function isSuperSession(session: { user?: { superAdmin?: boolean; email?: string | null; impersonatorId?: string | null } } | null): boolean {
  if (session?.user?.impersonatorId) return false;
  return session?.user?.superAdmin === true || isSuperAdminEmail(session?.user?.email);
}

// Rôles couverts par un niveau de visibilité (en plus du propriétaire).
const DIRECTION_ROLES = ["admin", "dirigeant", "direction"];
const GESTION_ROLES = ["gestionnaire", ...DIRECTION_ROLES];
export function roleCanSee(visibility: string, viewerRole: string | null | undefined): boolean {
  switch (visibility) {
    case "tous": return true;
    case "direction": return DIRECTION_ROLES.includes(viewerRole ?? "");
    case "gestionnaire": return GESTION_ROLES.includes(viewerRole ?? "");
    default: return false; // confidentiel : propriétaire uniquement
  }
}

// Garantit que les dossiers imposés + communs existent à la racine du drive de
// l'utilisateur. Synchronise nom / visibilité / lecture seule depuis la source.
export async function ensureDriveFolders(userId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const templates: any[] = await prisma.driveFolderTemplate.findMany({ orderBy: { order: "asc" } }).catch(() => []);
    // Arborescence souhaitée : dossiers par défaut (racine) + modèles communs
    // (éventuellement imbriqués via parentKey = templateKey du dossier parent).
    const wanted: { key: string; name: string; readonly: boolean; visibility: string; parentKey: string | null }[] = [
      ...DEFAULT_FOLDERS.map(d => ({ key: `default:${d.key}`, name: d.name, readonly: !!d.readonly, visibility: d.visibility ?? "confidentiel", parentKey: null })),
      ...templates.map(t => ({ key: `tpl:${t.id}`, name: t.name, readonly: !!t.readonly, visibility: t.visibility ?? "confidentiel", parentKey: (t.parentKey as string | null) ?? null })),
    ];
    // Tous les dossiers imposés existants de l'utilisateur (racine ET imbriqués).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing: any[] = await prisma.driveItem.findMany({
      where: { userId, system: true },
      select: { id: true, templateKey: true },
    }).catch(() => []);
    const byKey = new Map<string, string>(existing.map(e => [e.templateKey, e.id]));

    // Création/MAJ par passes : un dossier n'est traité qu'une fois son parent
    // présent, ce qui garantit l'ordre parent → enfant.
    let remaining = [...wanted];
    let guard = 0;
    while (remaining.length && guard++ < 12) {
      const next: typeof remaining = [];
      for (const w of remaining) {
        const parentId = w.parentKey ? byKey.get(w.parentKey) : null;
        if (w.parentKey && !parentId) { next.push(w); continue; } // parent pas encore créé
        const id = byKey.get(w.key);
        if (!id) {
          const created = await prisma.driveItem.create({ data: { userId, parentId: parentId ?? null, kind: "folder", name: w.name, system: true, readonly: w.readonly, visibility: w.visibility, templateKey: w.key }, select: { id: true } }).catch(() => null);
          if (created) byKey.set(w.key, created.id);
        } else {
          // Propage nom / visibilité / lecture seule / rattachement parent.
          await prisma.driveItem.update({ where: { id }, data: { name: w.name, readonly: w.readonly, visibility: w.visibility, parentId: parentId ?? null } }).catch(() => {});
        }
      }
      if (next.length === remaining.length) break; // plus de progression (parent manquant) → on arrête
      remaining = next;
    }
  } catch { /* best-effort */ }
}
