-- ═══════════════════════════════════════════════════════════════
-- Migration : espace d'échange fournisseur sur les ODS (portail externe)
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "supplierToken" TEXT;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS messages        JSONB;
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS "supplierFiles" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS service_orders_supplier_token_key
  ON service_orders ("supplierToken") WHERE "supplierToken" IS NOT NULL;
