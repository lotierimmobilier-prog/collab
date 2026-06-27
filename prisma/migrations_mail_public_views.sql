-- Copie publique des emails envoyés, accessible via un lien « Voir la version
-- en ligne » (au cas où le client mail du destinataire affiche mal le HTML).
-- Table possédée par l'application.
CREATE TABLE IF NOT EXISTS mail_public_views (
  token     TEXT PRIMARY KEY,
  subject   TEXT,
  html      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
