-- Expediteurs de confiance par utilisateur : leurs mails restent toujours en
-- boite de reception (jamais classes en Publicite). Table geree par l app.
CREATE TABLE IF NOT EXISTS mail_inbox_allow (
  id          TEXT PRIMARY KEY,
  "ownerId"   TEXT NOT NULL,
  email       TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS mail_inbox_allow_unique ON mail_inbox_allow("ownerId", email);
