-- ═══════════════════════════════════════════════════════════════
-- Migration : Connecteur ICS (MyICS / Spirit) — Collab
--   stockage de la configuration de connexion ; mot de passe chiffré
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_ics.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ics_config (
  id            TEXT PRIMARY KEY DEFAULT 'default',
  "authBaseUrl" TEXT NOT NULL DEFAULT 'https://auth.ics.fr/auth',
  realm         TEXT NOT NULL DEFAULT 'Production',
  "clientId"    TEXT NOT NULL DEFAULT 'myics-customer',
  "portalUrl"   TEXT NOT NULL DEFAULT 'https://my.ics.fr',
  "apiBaseUrl"  TEXT,
  username      TEXT,
  "passwordEnc" TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT false,
  "lastTestAt"  TIMESTAMP(3),
  "lastTestOk"  BOOLEAN NOT NULL DEFAULT false,
  "lastError"   TEXT,
  "updatedById" TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT now()
);
