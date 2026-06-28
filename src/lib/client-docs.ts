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

export interface DocMeta { id: string; source: string; category: string; fileName: string; mime: string | null; size: number | null; createdAt: string }

export async function listTenantDocs(tenantId: string): Promise<DocMeta[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, source, category, "fileName", mime, size, "createdAt"
         FROM tenant_documents WHERE "tenantId" = $1 ORDER BY "createdAt" DESC`, tenantId,
    );
    return rows.map(r => ({ id: r.id, source: r.source, category: r.category, fileName: r.fileName, mime: r.mime, size: r.size, createdAt: new Date(r.createdAt).toISOString() }));
  } catch { return []; }
}

export async function addTenantUpload(tenantId: string, category: string, fileName: string, mime: string, size: number, dataB64: string): Promise<{ id: string }> {
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO tenant_documents (id, "tenantId", source, category, "fileName", mime, size, data)
       VALUES ($1, $2, 'tenant', $3, $4, $5, $6, $7)`,
    id, tenantId, category, fileName.slice(0, 200), mime || null, size || null, dataB64,
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
