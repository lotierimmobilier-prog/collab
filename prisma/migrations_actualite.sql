-- Actualite immobiliere : referencement de sites configures par l administration.
-- Auguste va chercher les articles (titre, resume court, lien, date) et les
-- classe par sujet (gestion, syndic, transaction, divers). Rafraichi 24h.
-- Table geree par l app (acces via SQL brut).
CREATE TABLE IF NOT EXISTS actu_source (
  id              TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  url             TEXT NOT NULL,
  items           JSONB,
  "lastFetchedAt" TIMESTAMP(3),
  "lastError"     TEXT,
  "createdBy"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
