-- Documents de l'espace locataire :
--  · source 'agency'  : déposés par l'agence pour le locataire (bail, EDL, quittances…)
--  · source 'tenant'  : déposés par le locataire (assurance, entretien chaudière, clim…)
-- Table possédée par l'application.
CREATE TABLE IF NOT EXISTS tenant_documents (
  id          TEXT PRIMARY KEY,
  "tenantId"  TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'tenant',
  category    TEXT NOT NULL DEFAULT 'autre',
  "fileName"  TEXT NOT NULL,
  mime        TEXT,
  size        INTEGER,
  data        TEXT,                         -- contenu en base64
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tenant_documents_tenant_idx ON tenant_documents("tenantId");
