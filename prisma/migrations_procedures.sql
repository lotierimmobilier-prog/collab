-- Procédures d'entreprise (PDF / vidéo / lien). Idempotent.
CREATE TABLE IF NOT EXISTS "procedures" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'pdf',   -- pdf | video | link
  "fileName" TEXT,
  "mime" TEXT,
  "size" INTEGER,
  "data" TEXT,                          -- base64 (PDF ou vidéo téléversée)
  "url" TEXT,                           -- lien externe (YouTube/Vimeo…)
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "procedures_category_idx" ON "procedures"("category");
