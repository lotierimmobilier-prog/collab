-- Drive Parrain/Filleul : documents partages sur toute la lignee de parrainage
-- (ascendants + descendants). Table geree par l app. data = base64.
CREATE TABLE IF NOT EXISTS parrainage_doc (
  id          TEXT PRIMARY KEY,
  "ownerId"   TEXT NOT NULL,
  "fileName"  TEXT NOT NULL,
  mime        TEXT,
  size        INTEGER,
  note        TEXT,
  data        TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS parrainage_doc_owner ON parrainage_doc("ownerId");
