-- ═══════════════════════════════════════════════════════════════
-- Migration : rapprochement ICS des fournisseurs (export Fournisseurs)
--   Enrichit la table suppliers existante (N° ICS, IBAN, métier, scope…).
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "icsNum"        TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS metier          TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS iban            TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "modeReglement" TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS scope           TEXT NOT NULL DEFAULT 'gestion';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS "contactId"     TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_icsnum_key ON suppliers ("icsNum") WHERE "icsNum" IS NOT NULL;
CREATE INDEX IF NOT EXISTS suppliers_scope_idx ON suppliers (scope);
