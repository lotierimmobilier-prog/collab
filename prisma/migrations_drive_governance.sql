-- Gouvernance du Drive agent : dossiers imposés (système), visibilité posée par
-- le super admin, et dossiers communs poussés sur tous les drives.
ALTER TABLE drive_items ADD COLUMN IF NOT EXISTS "system"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE drive_items ADD COLUMN IF NOT EXISTS "readonly"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE drive_items ADD COLUMN IF NOT EXISTS "visibility" TEXT    NOT NULL DEFAULT 'confidentiel';
ALTER TABLE drive_items ADD COLUMN IF NOT EXISTS "templateKey" TEXT;

-- Dossiers communs définis par le super admin (poussés sur tous les drives).
CREATE TABLE IF NOT EXISTS drive_folder_templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  visibility  TEXT NOT NULL DEFAULT 'confidentiel',
  readonly    BOOLEAN NOT NULL DEFAULT false,
  "order"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
