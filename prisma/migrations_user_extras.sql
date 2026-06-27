-- Attributs utilisateur stockés dans une table annexe possédée par
-- l'application (le tableau « users » peut appartenir à un autre rôle
-- PostgreSQL et refuser les ALTER → parrain/ville/statut non persistés).
CREATE TABLE IF NOT EXISTS user_extras (
  "userId"          TEXT PRIMARY KEY,
  "parrainId"       TEXT,
  "city"            TEXT,
  "isEmployee"      BOOLEAN NOT NULL DEFAULT false,
  "gedAccess"       TEXT,
  "accessOverrides" JSONB,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS user_extras_parrain_idx ON user_extras ("parrainId");
