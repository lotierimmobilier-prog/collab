-- Ville de résidence de l'utilisateur (météo du tableau de bord)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "city" TEXT;
