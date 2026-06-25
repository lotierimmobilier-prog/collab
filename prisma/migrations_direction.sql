-- ═══════════════════════════════════════════════════════════════
-- Migration : module Direction (gestion d'entreprise) — Collab
--   flotte automobile, locaux loués, cartes professionnelles, assurances
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_direction.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vehicles (
  id                TEXT PRIMARY KEY,
  label             TEXT NOT NULL,
  immatriculation   TEXT,
  "holdType"        TEXT NOT NULL DEFAULT 'propriete',
  "assignedToId"    TEXT,
  "assignedName"    TEXT,
  insurer           TEXT,
  "startDate"       TIMESTAMP(3),
  "endDate"         TIMESTAMP(3),
  "controleTechnique" TIMESTAMP(3),
  "monthlyCost"     DOUBLE PRECISION,
  note              TEXT,
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS premises (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  address       TEXT,
  bailleur      TEXT,
  "startDate"   TIMESTAMP(3),
  "endDate"     TIMESTAMP(3),
  "rentMonthly" DOUBLE PRECISION,
  charges       DOUBLE PRECISION,
  note          TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pro_cards (
  id            TEXT PRIMARY KEY,
  "userId"      TEXT,
  "holderName"  TEXT NOT NULL,
  "cardNumber"  TEXT,
  "cardType"    TEXT,
  "issuedBy"    TEXT,
  "startDate"   TIMESTAMP(3),
  "expiryDate"  TIMESTAMP(3),
  note          TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL DEFAULT 'rc',
  insurer         TEXT,
  "policyNumber"  TEXT,
  "startDate"     TIMESTAMP(3),
  "endDate"       TIMESTAMP(3),
  "premiumAmount" DOUBLE PRECISION,
  note            TEXT,
  "createdById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT now()
);
