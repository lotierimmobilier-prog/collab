-- ═══════════════════════════════════════════════════════════════
-- Migration : demandes d'assistance locataire (lien public + photos)
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS assistance_requests (
  id            TEXT PRIMARY KEY,
  token         TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL DEFAULT 'locataire',
  "contactName"  TEXT,
  "contactPhone" TEXT,
  "contactEmail" TEXT,
  address       TEXT,
  description   TEXT,
  photos        JSONB,
  status        TEXT NOT NULL DEFAULT 'nouvelle',
  "odsId"       TEXT,
  "createdById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assistance_requests_status_idx ON assistance_requests (status);
