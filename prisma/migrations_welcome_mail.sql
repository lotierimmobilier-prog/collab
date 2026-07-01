-- Mail de bienvenue locataire : dossiers remplis par les agents commerciaux,
-- conserves dans Collab. Table geree par l app (SQL brut).
CREATE TABLE IF NOT EXISTS welcome_dossier (
  id           TEXT PRIMARY KEY,
  data         JSONB NOT NULL,
  "tenantName" TEXT,
  address      TEXT,
  "sentTo"     TEXT,
  "createdBy"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS welcome_dossier_creator ON welcome_dossier("createdBy");
