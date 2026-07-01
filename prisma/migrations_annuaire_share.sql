-- Partage de l annuaire du super admin : le super admin peut autoriser
-- certains utilisateurs a voir SES contacts, en plus des leurs. Table geree
-- par l app (acces via SQL brut).
CREATE TABLE IF NOT EXISTS annuaire_share (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
