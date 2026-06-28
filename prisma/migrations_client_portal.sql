-- Espace client (locataires) : codes à usage unique (OTP) pour l'authentification
-- par email. Table possédée par l'application.
CREATE TABLE IF NOT EXISTS client_otp (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  "codeHash"  TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS client_otp_email_idx ON client_otp(email);
