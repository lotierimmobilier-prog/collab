-- Suggestions d'amélioration proposées par les utilisateurs (roadmap interne).
CREATE TABLE IF NOT EXISTS "suggestions" (
  "id"          TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL,
  "userName"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "category"    TEXT,
  "status"      TEXT NOT NULL DEFAULT 'nouveau',
  "adminNote"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "suggestions_status_idx" ON "suggestions" ("status");

CREATE TABLE IF NOT EXISTS "suggestion_votes" (
  "id"           TEXT PRIMARY KEY,
  "suggestionId" TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "suggestion_votes_unique" ON "suggestion_votes" ("suggestionId", "userId");
