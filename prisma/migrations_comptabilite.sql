-- ═══════════════════════════════════════════════════════════════
-- Migration : Comptabilité (banque & trésorerie) — Collab
--   comptes de trésorerie, opérations bancaires, mémoire de classement
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_comptabilite.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bank_accounts (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'agence',
  "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  threshold        DOUBLE PRECISION,
  "createdById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id            TEXT PRIMARY KEY,
  "accountId"   TEXT NOT NULL,
  date          TIMESTAMP(3) NOT NULL,
  label         TEXT NOT NULL,
  amount        DOUBLE PRECISION NOT NULL,
  service       TEXT,
  nature        TEXT,
  recurring     BOOLEAN NOT NULL DEFAULT false,
  source        TEXT NOT NULL DEFAULT 'manual',
  "importId"    TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_transactions_accountId_idx ON bank_transactions("accountId");
CREATE INDEX IF NOT EXISTS bank_transactions_date_idx      ON bank_transactions(date);
CREATE INDEX IF NOT EXISTS bank_transactions_service_idx   ON bank_transactions(service);

CREATE TABLE IF NOT EXISTS txn_memory (
  id          TEXT PRIMARY KEY,
  pattern     TEXT NOT NULL UNIQUE,
  service     TEXT,
  recurring   BOOLEAN NOT NULL DEFAULT false,
  occurrences INTEGER NOT NULL DEFAULT 1,
  "lastDate"  TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);

-- Clé étrangère (ignorée si déjà présente)
DO $$ BEGIN
  ALTER TABLE bank_transactions
    ADD CONSTRAINT bank_transactions_accountId_fkey
    FOREIGN KEY ("accountId") REFERENCES bank_accounts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
