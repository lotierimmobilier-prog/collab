-- ═══════════════════════════════════════════════════════════════
-- Migration : fiche véhicule détaillée — Collab
--   documents (assurance / carte grise / permis), suivi km, sinistres
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_vehicle_details.sql
-- Additive et idempotente. (La table vehicles est détenue par l'utilisateur
--  applicatif, donc ces ALTER passent sans privilège superuser.)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "currentKm" INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS documents  JSONB;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS "kmReadings" JSONB;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS sinistres  JSONB;
