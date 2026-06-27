-- Fichiers volumineux d'email hébergés (lien de téléchargement public > 10 Mo).
CREATE TABLE IF NOT EXISTS "mail_uploads" (
  "id"        TEXT PRIMARY KEY,
  "token"     TEXT NOT NULL UNIQUE,
  "fileName"  TEXT NOT NULL,
  "mime"      TEXT,
  "size"      INTEGER,
  "data"      TEXT NOT NULL,
  "ownerId"   TEXT,
  "downloads" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3)
);
