-- Migration: mémoire de classification des mails par Auguste
-- À exécuter sur le VPS : psql -U collab_user -d collab_db -f migration_memory.sql

CREATE TABLE IF NOT EXISTS mail_label_memory (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fromEmail"   TEXT NOT NULL UNIQUE,
  "labelIds"    TEXT[] NOT NULL DEFAULT '{}',
  "assignedToId" TEXT,
  note          TEXT,
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT NOW()
);
