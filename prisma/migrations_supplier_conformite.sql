-- Conformité fournisseurs v2 : attestation URSSAF + espace fournisseur (dépôt
-- par lien) + relance. Idempotent.
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "urssafExpiry"       TIMESTAMP(3);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "urssafDoc"          JSONB;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "portalToken"        TEXT;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "lastConfReminderAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_portalToken_key" ON "suppliers"("portalToken");
