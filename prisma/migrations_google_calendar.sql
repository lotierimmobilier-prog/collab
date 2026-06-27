-- Connexion Google Agenda permanente (OAuth serveur, refresh_token chiffré).
CREATE TABLE IF NOT EXISTS "google_calendar_accounts" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL UNIQUE,
  "googleEmail"  TEXT,
  "refreshToken" TEXT NOT NULL,
  "accessToken"  TEXT,
  "accessExpiry" TIMESTAMP(3),
  "selected"     TEXT[] NOT NULL DEFAULT '{}',
  "calendars"    JSONB,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
