-- Statut « salarié de l'agence » : ouvre le module RH (décompte d'heures, congés)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isEmployee" BOOLEAN NOT NULL DEFAULT false;
