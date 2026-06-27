-- Conformité fournisseurs : attestation d'assurance (décennale / RC pro).
-- Idempotent.
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "insuranceType"   TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "insurer"         TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "insurancePolicy" TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "insuranceExpiry" TIMESTAMP(3);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "insuranceDoc"    JSONB;
