-- Visibilité des menus par utilisateur : liste des entrées masquées (JSON),
-- choisie par le super admin. Indépendant des droits d'accès (rôle).
ALTER TABLE user_extras ADD COLUMN IF NOT EXISTS "hiddenMenus" TEXT;
