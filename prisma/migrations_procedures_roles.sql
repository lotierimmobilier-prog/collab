-- Procédures ciblées par rôle (vide = tout le monde). Idempotent.
ALTER TABLE "procedures" ADD COLUMN IF NOT EXISTS "roles" TEXT[] NOT NULL DEFAULT '{}';
