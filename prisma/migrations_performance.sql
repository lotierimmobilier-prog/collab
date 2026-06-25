-- ═══════════════════════════════════════════════════════════════
-- Migration : performances commerciales (classement du trimestre) — Collab
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_performance.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS performance_entries (
  id            TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  type          TEXT NOT NULL,            -- vente | mandat_vente | mandat_loc | mise_en_loc
  label         TEXT,
  amount        DOUBLE PRECISION,
  date          TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS performance_entries_userId_idx ON performance_entries("userId");
CREATE INDEX IF NOT EXISTS performance_entries_type_idx   ON performance_entries(type);
CREATE INDEX IF NOT EXISTS performance_entries_date_idx   ON performance_entries(date);
