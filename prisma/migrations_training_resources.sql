-- Supports de formation rattachés à une compétence : lien externe OU fichier
-- déposé (base64). Table possédée par l'application.
CREATE TABLE IF NOT EXISTS training_resources (
  id            TEXT PRIMARY KEY,
  "competenceId" TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT,
  "fileName"    TEXT,
  mime          TEXT,
  size          INTEGER,
  data          TEXT,
  "order"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_resources_competence_idx ON training_resources ("competenceId");
