-- ═══════════════════════════════════════════════════════════════
-- Migration : fiche locale détaillée — Collab
--   assureur, documents (assurance/bail/diagnostics), sinistres,
--   contrôles de sécurité
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_premise_details.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE premises ADD COLUMN IF NOT EXISTS insurer   TEXT;
ALTER TABLE premises ADD COLUMN IF NOT EXISTS documents JSONB;
ALTER TABLE premises ADD COLUMN IF NOT EXISTS sinistres JSONB;
ALTER TABLE premises ADD COLUMN IF NOT EXISTS controls  JSONB;
