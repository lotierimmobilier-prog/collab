-- Décompte des heures (format légal L.143-14) : en-tête + double signature. Idempotent.
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "societe"                TEXT;
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "employe"                TEXT;
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "heureHebdo"             DOUBLE PRECISION;
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "avantageNature"         TEXT;
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "acompte"                DOUBLE PRECISION;
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "acompteMode"            TEXT;
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "primeMotif"             TEXT;
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "primeMontant"           DOUBLE PRECISION;
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "directionSignedAt"      TIMESTAMP(3);
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "directionSignatureName" TEXT;
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "directionSignatureIp"   TEXT;
ALTER TABLE "monthly_hours" ADD COLUMN IF NOT EXISTS "sentToAccountantAt"     TIMESTAMP(3);
