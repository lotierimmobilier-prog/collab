-- Suivi de consommation Auguste : tokens d'entrée/sortie + fonctionnalité.
-- Idempotent.
ALTER TABLE auguste_logs ADD COLUMN IF NOT EXISTS "inputTokens"  INTEGER;
ALTER TABLE auguste_logs ADD COLUMN IF NOT EXISTS "outputTokens" INTEGER;
ALTER TABLE auguste_logs ADD COLUMN IF NOT EXISTS "feature"      TEXT;
