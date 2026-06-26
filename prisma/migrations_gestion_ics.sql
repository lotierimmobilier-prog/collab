-- ═══════════════════════════════════════════════════════════════
-- Migration : liaison module Gestion ↔ base ICS — Collab
--   références ICS sur owners / lots / tenants / baux pour la synchro
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_gestion_ics.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE owners  ADD COLUMN IF NOT EXISTS "icsMandat" TEXT;
ALTER TABLE lots    ADD COLUMN IF NOT EXISTS "icsLot"    TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "icsBail"   TEXT;
ALTER TABLE baux    ADD COLUMN IF NOT EXISTS "icsBail"   TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS owners_icsmandat_key  ON owners  ("icsMandat");
CREATE UNIQUE INDEX IF NOT EXISTS lots_icslot_key       ON lots    ("icsLot");
CREATE UNIQUE INDEX IF NOT EXISTS tenants_icsbail_key   ON tenants ("icsBail");
CREATE UNIQUE INDEX IF NOT EXISTS baux_icsbail_key      ON baux    ("icsBail");
