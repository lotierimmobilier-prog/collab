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
-- Détail par trimestre : { t: [T1,T2,T3,T4], g: [T1,T2,T3,T4] }
ALTER TABLE "protexa_mandates" ADD COLUMN IF NOT EXISTS "quarters" JSONB;
