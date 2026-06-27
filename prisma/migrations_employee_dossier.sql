-- Dossier du salarié (direction) : contrats, fiche de suivi annuel,
-- RDV médecine du travail, complémentaire santé…
CREATE TABLE IF NOT EXISTS "employee_documents" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "category"    TEXT NOT NULL,
  "label"       TEXT,
  "issuer"      TEXT,
  "number"      TEXT,
  "issuedAt"    TIMESTAMP(3),
  "expiresAt"   TIMESTAMP(3),
  "fileName"    TEXT,
  "mime"        TEXT,
  "size"        INTEGER,
  "data"        TEXT,
  "note"        TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "employee_documents_userId_category_idx" ON "employee_documents" ("userId", "category");
