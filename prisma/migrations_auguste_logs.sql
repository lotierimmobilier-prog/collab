-- ═══════════════════════════════════════════════════════════════
-- Migration : journal des demandes à Auguste (audit admin) — Collab
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_auguste_logs.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS auguste_logs (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "userName"  TEXT NOT NULL,
  question    TEXT NOT NULL,
  reply       TEXT,
  tools       TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auguste_logs_createdAt_idx ON auguste_logs("createdAt");
CREATE INDEX IF NOT EXISTS auguste_logs_userId_idx    ON auguste_logs("userId");
