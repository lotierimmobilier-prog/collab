-- Migration : tables comptabilité gestion locative
CREATE TABLE IF NOT EXISTS appels_loyer (
  id           TEXT PRIMARY KEY,
  reference    TEXT NOT NULL UNIQUE,
  "bailId"     TEXT NOT NULL REFERENCES baux(id) ON DELETE CASCADE,
  periode      TEXT NOT NULL,
  "montantHC"  DOUBLE PRECISION NOT NULL,
  charges      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalCC"    DOUBLE PRECISION NOT NULL,
  echeance     TIMESTAMP NOT NULL,
  status       TEXT NOT NULL DEFAULT 'emis',
  notes        TEXT,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS encaissements (
  id                   TEXT PRIMARY KEY,
  reference            TEXT NOT NULL UNIQUE,
  "appelId"            TEXT REFERENCES appels_loyer(id) ON DELETE SET NULL,
  "bailId"             TEXT NOT NULL REFERENCES baux(id) ON DELETE CASCADE,
  montant              DOUBLE PRECISION NOT NULL,
  "dateReglement"      TIMESTAMP NOT NULL,
  "modePaiement"       TEXT NOT NULL DEFAULT 'virement',
  reference_paiement   TEXT,
  notes                TEXT,
  "createdAt"          TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS depots_garantie (
  id                 TEXT PRIMARY KEY,
  "bailId"           TEXT NOT NULL UNIQUE REFERENCES baux(id) ON DELETE CASCADE,
  montant            DOUBLE PRECISION NOT NULL,
  "dateRecep"        TIMESTAMP NOT NULL,
  "dateRestitution"  TIMESTAMP,
  "montantRestitue"  DOUBLE PRECISION,
  status             TEXT NOT NULL DEFAULT 'conserve',
  notes              TEXT,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT NOW()
);
