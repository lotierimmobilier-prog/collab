-- Suivi des attestations d'assurance : date d'échéance + étape de relance déjà
-- envoyée (idempotence des rappels).
ALTER TABLE tenant_documents ADD COLUMN IF NOT EXISTS "validUntil" TIMESTAMP(3);
ALTER TABLE tenant_documents ADD COLUMN IF NOT EXISTS "reminderStage" INTEGER NOT NULL DEFAULT 0;
