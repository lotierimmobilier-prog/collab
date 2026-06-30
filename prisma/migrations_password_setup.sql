-- Jetons à usage unique pour la création du mot de passe par le nouvel
-- utilisateur (lien de l'email de bienvenue).
CREATE TABLE IF NOT EXISTS "password_setup_tokens" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "password_setup_tokens_token_key" ON "password_setup_tokens" ("token");
CREATE INDEX IF NOT EXISTS "password_setup_tokens_user_idx" ON "password_setup_tokens" ("userId");
