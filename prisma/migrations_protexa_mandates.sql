-- Mandats signés par négociateur, synchronisés depuis Protexa (registre T et G).
CREATE TABLE IF NOT EXISTS "protexa_mandates" (
  "id"          TEXT PRIMARY KEY,
  "negociateur" TEXT NOT NULL,
  "transaction" INTEGER NOT NULL DEFAULT 0,
  "gestion"     INTEGER NOT NULL DEFAULT 0,
  "userId"      TEXT,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "protexa_mandates_negociateur_key" ON "protexa_mandates" ("negociateur");
