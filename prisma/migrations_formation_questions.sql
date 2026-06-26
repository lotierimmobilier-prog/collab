-- ═══════════════════════════════════════════════════════════════
-- Migration : Formation — questions de contrôle (QCM) + réponses filleul
-- À exécuter via : psql "$DATABASE_URL" -f prisma/migrations_formation_questions.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS training_questions (
  id             TEXT PRIMARY KEY,
  "competenceId" TEXT NOT NULL,
  prompt         TEXT NOT NULL,
  choices        JSONB NOT NULL DEFAULT '[]'::jsonb,
  "correctIndex" INTEGER NOT NULL DEFAULT 0,
  explanation    TEXT,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_questions_competence_idx ON training_questions ("competenceId");

ALTER TABLE competence_validations ADD COLUMN IF NOT EXISTS quiz JSONB;
