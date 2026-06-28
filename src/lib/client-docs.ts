// Documents de l'espace locataire (table tenant_documents). Toujours filtré par
// tenantId. Le locataire dépose ses justificatifs et télécharge ses documents.
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 Mo

// Catégories que le LOCATAIRE peut déposer.
export const UPLOAD_CATEGORIES: { id: string; label: string }[] = [
  { id: "assurance",     label: "Attestation d'assurance habitation" },
  { id: "chaudiere",     label: "Entretien chaudière" },
  { id: "climatisation", label: "Entretien climatisation" },
  { id: "autre",         label: "Autre justificatif" },
];
export const UPLOAD_CATEGORY_IDS = UPLOAD_CATEGORIES.map(c => c.id);

// Libellés des catégories de documents fournis par l'AGENCE.
export const AGENCY_CATEGORY_LABEL: Record<string, string> = {
  bail: "Bail", etat_lieux: "État des lieux", quittance: "Quittance de loyer",
  attestation_loyer: "Attestation de loyer", caf: "Document CAF", autre: "Document",
};

export interface DocMeta { id: string; source: string; category: string; fileName: string; mime: string | null; size: number | null; createdAt: string; validUntil: string | null }

export async function listTenantDocs(tenantId: string): Promise<DocMeta[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, source, category, "fileName", mime, size, "createdAt", "validUntil"
         FROM tenant_documents WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`, tenantId,
    );
    return rows.map(r => ({ id: r.id, source: r.source, category: r.category, fileName: r.fileName, mime: r.mime, size: r.size, createdAt: new Date(r.createdAt).toISOString(), validUntil: r.validUntil ? new Date(r.validUntil).toISOString() : null }));
  } catch { return []; }
}

// Échéance par défaut d'une attestation d'assurance déposée sans date : +1 an.
function defaultValidUntil(category: string, validUntil?: Date | null): Date | null {
  if (validUntil) return validUntil;
  if (category === "assurance") { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; }
  return null;
}

export async function addTenantUpload(tenantId: string, category: string, fileName: string, mime: string, size: number, dataB64: string, validUntil?: Date | null): Promise<{ id: string }> {
  const id = randomUUID();
  const echeance = defaultValidUntil(category, validUntil);
  // reminderStage repart à 0 : une nouvelle attestation relance le cycle de rappels.
  await prisma.$executeRawUnsafe(
    `INSERT INTO tenant_documents (id, "tenantId", source, category, "fileName", mime, size, data, "validUntil", "reminderStage")
       VALUES ($1, $2, 'tenant', $3, $4, $5, $6, $7, $8, 0)`,
    id, tenantId, category, fileName.slice(0, 200), mime || null, size || null, dataB64, echeance,
  );
  return { id };
}

// Récupère un document EN VÉRIFIANT qu'il appartient bien au locataire.
export async function getTenantDoc(tenantId: string, id: string): Promise<{ fileName: string; mime: string | null; data: string } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT "fileName", mime, data FROM tenant_documents WHERE id = $1 AND "tenantId" = $2 LIMIT 1`, id, tenantId,
    );
    const r = rows[0];
    if (!r?.data) return null;
    return { fileName: r.fileName, mime: r.mime, data: r.data };
  } catch { return null; }
}

// Suppression : seulement les documents déposés par le locataire lui-même.
export async function removeTenantUpload(tenantId: string, id: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM tenant_documents WHERE id = $1 AND "tenantId" = $2 AND source = 'tenant'`, id, tenantId,
  ).catch(() => {});
}

// ── Côté AGENCE (utilisateur interne) ──
export const AGENCY_CATEGORIES: { id: string; label: string }[] = [
  { id: "bail", label: "Bail" },
  { id: "etat_lieux", label: "État des lieux" },
  { id: "quittance", label: "Quittance de loyer" },
  { id: "attestation_loyer", label: "Attestation de loyer" },
  { id: "caf", label: "Document CAF" },
  { id: "autre", label: "Document" },
];
export const AGENCY_CATEGORY_IDS = AGENCY_CATEGORIES.map(c => c.id);

// L'agence dépose un document pour un locataire (source 'agency').
export async function addAgencyDoc(tenantId: string, category: string, fileName: string, mime: string, size: number, dataB64: string): Promise<{ id: string }> {
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO tenant_documents (id, "tenantId", source, category, "fileName", mime, size, data)
       VALUES ($1, $2, 'agency', $3, $4, $5, $6, $7)`,
    id, tenantId, category, fileName.slice(0, 200), mime || null, size || null, dataB64,
  );
  return { id };
}

// Lecture interne d'un document (sans filtre locataire — réservé à l'agence).
export async function getAnyDoc(id: string): Promise<{ fileName: string; mime: string | null; data: string } | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT "fileName", mime, data FROM tenant_documents WHERE id = $1 LIMIT 1`, id);
    const r = rows[0];
    if (!r?.data) return null;
    return { fileName: r.fileName, mime: r.mime, data: r.data };
  } catch { return null; }
}

export async function removeAnyDoc(id: string): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM tenant_documents WHERE id = $1`, id).catch(() => {});
}

// Vue d'ensemble : nb de justificatifs déposés par locataire (pour la liste agence).
export async function uploadsCountByTenant(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT "tenantId", count(*)::int AS n FROM tenant_documents WHERE source = 'tenant' GROUP BY "tenantId"`);
    for (const r of rows) map.set(r.tenantId, Number(r.n));
  } catch { /* vide */ }
  return map;
}

// ── Suivi des attestations d'assurance ──

export interface InsuranceDoc { id: string; tenantId: string; validUntil: string | null; reminderStage: number; createdAt: string }
export interface InsuranceRow extends InsuranceDoc { prenom: string; nom: string; email: string | null }

export type InsuranceState = "absente" | "valide" | "bientot" | "expiree";
export interface InsuranceStatus { state: InsuranceState; label: string; validUntil: string | null; days: number | null }

// Renvoie un statut lisible à partir de la date d'échéance de la dernière attestation.
export function insuranceStatus(validUntil: string | null): InsuranceStatus {
  if (!validUntil) return { state: "absente", label: "Aucune attestation", validUntil: null, days: null };
  const d = new Date(validUntil);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  const dfr = d.toLocaleDateString("fr-FR");
  if (days < 0) return { state: "expiree", label: `Expirée le ${dfr}`, validUntil, days };
  if (days <= 30) return { state: "bientot", label: `Expire le ${dfr}`, validUntil, days };
  return { state: "valide", label: `Valide jusqu'au ${dfr}`, validUntil, days };
}

// Dernière attestation d'assurance déposée par locataire (id, échéance, étape de rappel).
export async function latestInsuranceByTenant(): Promise<Map<string, InsuranceDoc>> {
  const map = new Map<string, InsuranceDoc>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON ("tenantId") id, "tenantId", "validUntil", "reminderStage", "createdAt"
         FROM tenant_documents WHERE category = 'assurance'
         ORDER BY "tenantId", "createdAt" DESC`,
    );
    for (const r of rows) map.set(r.tenantId, {
      id: r.id, tenantId: r.tenantId,
      validUntil: r.validUntil ? new Date(r.validUntil).toISOString() : null,
      reminderStage: Number(r.reminderStage ?? 0),
      createdAt: new Date(r.createdAt).toISOString(),
    });
  } catch { /* vide */ }
  return map;
}

// Dernières attestations d'assurance avec coordonnées du locataire (pour les relances).
export async function latestInsuranceWithTenant(): Promise<InsuranceRow[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON (d."tenantId") d.id, d."tenantId", d."validUntil", d."reminderStage", d."createdAt",
              t.prenom, t.nom, t.email
         FROM tenant_documents d JOIN tenants t ON t.id = d."tenantId"
        WHERE d.category = 'assurance'
        ORDER BY d."tenantId", d."createdAt" DESC`,
    );
    return rows.map(r => ({
      id: r.id, tenantId: r.tenantId,
      validUntil: r.validUntil ? new Date(r.validUntil).toISOString() : null,
      reminderStage: Number(r.reminderStage ?? 0),
      createdAt: new Date(r.createdAt).toISOString(),
      prenom: r.prenom ?? "", nom: r.nom ?? "", email: r.email ?? null,
    }));
  } catch { return []; }
}

export async function setInsuranceReminderStage(docId: string, stage: number): Promise<void> {
  await prisma.$executeRawUnsafe(`UPDATE tenant_documents SET "reminderStage" = $2 WHERE id = $1`, docId, stage).catch(() => {});
}
