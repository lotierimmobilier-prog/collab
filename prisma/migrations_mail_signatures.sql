-- Signature d'email par utilisateur ET par compte : même sur une boîte
-- partagée (ex. gestion@ utilisée par le gestionnaire et le super admin),
-- chacun a sa propre signature. Table possédée par l'application.
CREATE TABLE IF NOT EXISTS mail_signatures (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  signature   TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS mail_signatures_user_account ON mail_signatures("userId", "accountId");
