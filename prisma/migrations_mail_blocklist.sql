-- Expéditeurs indésirables (spam) par utilisateur : leurs mails entrants vont
-- directement à la corbeille. Table possédée par l'application.
CREATE TABLE IF NOT EXISTS mail_blocked_senders (
  id          TEXT PRIMARY KEY,
  "ownerId"   TEXT NOT NULL,
  email       TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS mail_blocked_unique ON mail_blocked_senders("ownerId", email);
