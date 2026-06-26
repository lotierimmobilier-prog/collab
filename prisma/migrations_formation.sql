-- ═══════════════════════════════════════════════════════════════
-- Migration : module Formation par parrainage — Collab
--   parrain↔filleul + modules / compétences / double validation
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_formation.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS "parrainId" TEXT;

CREATE TABLE IF NOT EXISTS training_modules (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  "order"     INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_competences (
  id          TEXT PRIMARY KEY,
  "moduleId"  TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_competences_module_idx ON training_competences ("moduleId");

CREATE TABLE IF NOT EXISTS competence_validations (
  id                   TEXT PRIMARY KEY,
  "competenceId"       TEXT NOT NULL,
  "filleulId"          TEXT NOT NULL,
  dates                JSONB,
  "parrainValidated"   BOOLEAN NOT NULL DEFAULT false,
  "parrainValidatedAt" TIMESTAMP(3),
  "parrainComment"     TEXT,
  "filleulValidated"   BOOLEAN NOT NULL DEFAULT false,
  "filleulValidatedAt" TIMESTAMP(3),
  "filleulComment"     TEXT,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE ("competenceId", "filleulId")
);
CREATE INDEX IF NOT EXISTS competence_validations_filleul_idx ON competence_validations ("filleulId");
