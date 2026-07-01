-- Veille juridique : flux RSS regroupes en familles, analyses toutes les 24h.
-- Visible par tout le monde. Tables gerees par l app (acces via SQL brut).
CREATE TABLE IF NOT EXISTS veille_family (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS veille_feed (
  id              TEXT PRIMARY KEY,
  "familyId"      TEXT,
  title           TEXT NOT NULL,
  url             TEXT NOT NULL,
  analysis        TEXT,
  items           JSONB,
  "lastAnalyzedAt" TIMESTAMP(3),
  "lastError"     TEXT,
  "createdBy"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS veille_feed_family ON veille_feed("familyId");
