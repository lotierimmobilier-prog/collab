-- ═══════════════════════════════════════════════════════════════
-- Migration : journal d'activité & présence — Collab
--   connexions / déconnexions / actions + temps passé par utilisateur
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_activity.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS activity_logs (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT,
  "userName"  TEXT,
  kind        TEXT NOT NULL DEFAULT 'action',
  label       TEXT,
  path        TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activity_logs_user_idx ON activity_logs ("userId");
CREATE INDEX IF NOT EXISTS activity_logs_created_idx ON activity_logs ("createdAt");

CREATE TABLE IF NOT EXISTS user_presence (
  id         TEXT PRIMARY KEY,
  "userId"   TEXT NOT NULL,
  "userName" TEXT,
  day        TEXT NOT NULL,
  seconds    INTEGER NOT NULL DEFAULT 0,
  "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE ("userId", day)
);
CREATE INDEX IF NOT EXISTS user_presence_day_idx ON user_presence (day);

-- Mémoire d'Auguste : glossaire des termes techniques appris.
CREATE TABLE IF NOT EXISTS auguste_terms (
  id          TEXT PRIMARY KEY,
  term        TEXT NOT NULL UNIQUE,
  definition  TEXT,
  occurrences INTEGER NOT NULL DEFAULT 1,
  "lastUsed"  TIMESTAMP(3) NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
