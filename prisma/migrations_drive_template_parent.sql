-- Sous-dossiers imposés : un modèle de dossier peut avoir un parent (via la
-- templateKey du dossier imposé parent, ex. "tpl:abc" ou "default:mandats").
-- Idempotent.
ALTER TABLE drive_folder_templates ADD COLUMN IF NOT EXISTS "parentKey" TEXT;
