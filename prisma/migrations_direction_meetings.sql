-- ═══════════════════════════════════════════════════════════════
-- Migration : comptes rendus de réunion de direction — Collab
--   pièces jointes PDF / audio stockées en base64 (colonne JSONB)
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_direction_meetings.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS direction_meetings (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT 'Réunion de direction',
  date          TIMESTAMP(3) NOT NULL,
  participants  TEXT,
  summary       TEXT,
  documents     JSONB,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS direction_meetings_date_idx ON direction_meetings (date);
