-- ═══════════════════════════════════════════════════════════════
-- Migration : détail d'intervention + suivi d'envoi sur les ODS
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "interventionType" TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "onSiteName"       TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "onSitePhone"      TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "onSiteRole"       TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "keyAtAgency"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "accessInfo"       TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS urgency            TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "quoteRequired"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "agentName"        TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "agentPhone"       TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "sentAt"           TIMESTAMP(3);
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "sentTo"           TEXT;
