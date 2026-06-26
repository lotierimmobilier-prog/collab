-- ═══════════════════════════════════════════════════════════════
-- Migration : Connecteur ICS (MyICS / Spirit) — Collab
--   stockage de la configuration de connexion ; mot de passe chiffré
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_ics.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ics_config (
  id              TEXT PRIMARY KEY DEFAULT 'default',
  "authBaseUrl"   TEXT NOT NULL DEFAULT 'https://auth.ics.fr/auth',
  realm           TEXT NOT NULL DEFAULT 'Production',
  "clientId"      TEXT NOT NULL DEFAULT 'myics-customer',
  "portalUrl"     TEXT NOT NULL DEFAULT 'https://my.ics.fr',
  "apiBaseUrl"    TEXT,
  "spiritApiBase" TEXT NOT NULL DEFAULT 'https://spirit6back.ics.fr/GeranceNet',
  "gedApiBase"    TEXT NOT NULL DEFAULT 'https://ged-tomcat1.ics.fr/tomcat/Ged',
  "idSociete"     TEXT NOT NULL DEFAULT '54246',
  username        TEXT,
  "passwordEnc"   TEXT,
  enabled         BOOLEAN NOT NULL DEFAULT false,
  "lastTestAt"    TIMESTAMP(3),
  "lastTestOk"    BOOLEAN NOT NULL DEFAULT false,
  "lastError"     TEXT,
  "updatedById"   TEXT,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT now()
);
-- Colonnes ajoutées après coup (idempotent) si la table existait déjà.
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "spiritApiBase" TEXT NOT NULL DEFAULT 'https://spirit6back.ics.fr/GeranceNet';
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "gedApiBase"    TEXT NOT NULL DEFAULT 'https://ged-tomcat1.ics.fr/tomcat/Ged';
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "idSociete"     TEXT NOT NULL DEFAULT '54246';

CREATE TABLE IF NOT EXISTS ics_tenants (
  id                   TEXT PRIMARY KEY,
  "idBail"             TEXT NOT NULL UNIQUE,
  "idLot"              TEXT,
  "idMandat"           TEXT,
  portefeuille         TEXT,
  "civiliteLoc"        TEXT,
  "nomLocataire"       TEXT,
  "prenomLocataire"    TEXT,
  email                TEXT,
  mobile               TEXT,
  telephone            TEXT,
  "categorieBail"      TEXT,
  "typeBail"           TEXT,
  "dateEffet"          TEXT,
  loyer                TEXT,
  "nomImmeuble"        TEXT,
  "adresseImmeuble"    TEXT,
  "civiliteProprio"    TEXT,
  "nomProprietaire"    TEXT,
  "prenomProprietaire" TEXT,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ics_tenants_nomlocataire_idx ON ics_tenants ("nomLocataire");
CREATE INDEX IF NOT EXISTS ics_tenants_nomproprietaire_idx ON ics_tenants ("nomProprietaire");

-- Rapprochement des fiches annuaire avec les références ICS.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "icsType"  TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "icsRef"   TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS "icsIdLot" TEXT;

-- Accès direct à la GED (ged-tomcat1).
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "gedSociete"     TEXT;
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "gedEmail"       TEXT;
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "gedPasswordEnc" TEXT;
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "gedCle"         TEXT;
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "gedToken"       TEXT;
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "gedTokenExp"    TIMESTAMP(3);
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "gedLastTestOk"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE ics_config ADD COLUMN IF NOT EXISTS "gedLastError"   TEXT;

-- Droit d'accès à la GED par utilisateur (null = défaut selon rôle).
ALTER TABLE users ADD COLUMN IF NOT EXISTS "gedAccess" TEXT;
