-- Migration : notes personnelles + appels téléphoniques (dashboard)
CREATE TABLE IF NOT EXISTS personal_notes (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#FFFBEB',
  pinned      BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phone_calls (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL,
  contact     TEXT NOT NULL,
  phone       TEXT,
  direction   TEXT NOT NULL DEFAULT 'inbound',
  status      TEXT NOT NULL DEFAULT 'to_call',
  subject     TEXT,
  notes       TEXT,
  "calledAt"  TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
