-- Pointes de tresorerie (gestion / syndic) : PDF televerse, montant lu par
-- Auguste ou saisi, compare a la garantie financiere. Table geree par l app.
CREATE TABLE IF NOT EXISTS treso_pointe (
  id          TEXT PRIMARY KEY,
  service     TEXT NOT NULL,
  "fileName"  TEXT NOT NULL,
  data        TEXT NOT NULL,
  amount      DOUBLE PRECISION,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS treso_pointe_service ON treso_pointe(service);
