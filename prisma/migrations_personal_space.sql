-- Espace personnel : documents administratifs/légaux + drive personnel.
-- Idempotent (rejouable sans effet de bord).

CREATE TABLE IF NOT EXISTS "personal_documents" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,            -- assurance_pro | carte_pro | alur | rib | piece_identite | autre
  "label" TEXT,
  "number" TEXT,
  "issuer" TEXT,
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "alurHours" INTEGER,             -- heures de formation ALUR
  "fileName" TEXT,
  "mime" TEXT,
  "size" INTEGER,
  "data" TEXT,                     -- fichier en base64
  "lastReminderAt" TIMESTAMP(3),   -- dernier rappel email envoyé
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "personal_documents_userId_idx" ON "personal_documents"("userId");

CREATE TABLE IF NOT EXISTS "drive_items" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "parentId" TEXT,                 -- dossier parent (NULL = racine)
  "kind" TEXT NOT NULL,            -- folder | file
  "name" TEXT NOT NULL,
  "mime" TEXT,
  "size" INTEGER,
  "data" TEXT,                     -- fichier en base64 (NULL pour un dossier)
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "drive_items_user_parent_idx" ON "drive_items"("userId", "parentId");
