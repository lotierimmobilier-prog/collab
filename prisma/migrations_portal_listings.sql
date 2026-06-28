-- Registre des annonces des portails (Leboncoin, Bienici, Le Figaro) pour
-- l'automatisation des réponses aux leads (vente / gestion).
CREATE TABLE IF NOT EXISTS portal_listings (
  id                 TEXT PRIMARY KEY,
  platform           TEXT NOT NULL,            -- leboncoin | bienici | lefigaro
  reference          TEXT NOT NULL,            -- référence de l'annonce sur le portail
  title              TEXT,
  price              TEXT,
  type               TEXT NOT NULL DEFAULT 'vente', -- vente | gestion
  "agentName"        TEXT,
  "agentPhone"       TEXT,
  "ficheDriveItemId" TEXT,                      -- fiche PDF (drive) pour la vente
  "zelokLink"        TEXT,                      -- lien ZELOK dédié pour la gestion
  active             BOOLEAN NOT NULL DEFAULT true,
  "createdBy"        TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS portal_listings_platform_ref
  ON portal_listings(platform, reference);
