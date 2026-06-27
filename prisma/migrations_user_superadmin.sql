-- Statut « super administrateur » (gouvernance des admins). Stocké dans la
-- table annexe user_extras, possédée par l'application (la table « users »
-- peut appartenir à un autre rôle PostgreSQL et refuser les ALTER).
ALTER TABLE user_extras ADD COLUMN IF NOT EXISTS "superAdmin" BOOLEAN NOT NULL DEFAULT false;
