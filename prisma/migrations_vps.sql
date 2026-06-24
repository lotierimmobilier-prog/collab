-- ═══════════════════════════════════════════════════════════════
-- Migration VPS v1.3 + v1.4 — Collab Lotier Immobilier
-- À exécuter via :  psql -U collab_user -d collab_db -f prisma/migrations_vps.sql
-- ═══════════════════════════════════════════════════════════════

-- ── Familles de tâches ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_families (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#B8966A',
  icon        TEXT,
  "order"     INT  NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Groupes de tâches ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_groups (
  id          TEXT PRIMARY KEY,
  "familyId"  TEXT NOT NULL REFERENCES task_families(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  "order"     INT  NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Tâches ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'todo',
  priority      TEXT NOT NULL DEFAULT 'moyenne',
  "assigneeId"  TEXT REFERENCES users(id) ON DELETE SET NULL,
  "assigneeName" TEXT,
  "familyId"    TEXT REFERENCES task_families(id) ON DELETE SET NULL,
  "groupId"     TEXT REFERENCES task_groups(id)   ON DELETE SET NULL,
  "dueDate"     TIMESTAMPTZ,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  project       TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Colonnes manquantes si la table tasks existait déjà (v1.3 → v1.4)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "familyId" TEXT REFERENCES task_families(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "groupId"  TEXT REFERENCES task_groups(id)   ON DELETE SET NULL;

-- ── Événements agenda ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  location    TEXT,
  start       TIMESTAMPTZ NOT NULL,
  "end"       TIMESTAMPTZ NOT NULL,
  "allDay"    BOOLEAN     NOT NULL DEFAULT false,
  color       TEXT        NOT NULL DEFAULT '#B8966A',
  type        TEXT        NOT NULL DEFAULT 'autre',
  "createdBy" TEXT        NOT NULL,
  attendees   JSONB,
  "googleId"  TEXT,
  "notifSent" BOOLEAN     NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Messagerie interne ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  description TEXT,
  "isDirect"  BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT    NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_members (
  id          TEXT PRIMARY KEY,
  "channelId" TEXT NOT NULL REFERENCES channels(id)  ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  "joinedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("channelId", "userId")
);

CREATE TABLE IF NOT EXISTS internal_messages (
  id          TEXT PRIMARY KEY,
  "channelId" TEXT    NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  "senderId"  TEXT    NOT NULL REFERENCES users(id),
  content     TEXT    NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "readBy"    TEXT[]  NOT NULL DEFAULT '{}'
);

-- ── Notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL,
  title       TEXT    NOT NULL,
  body        TEXT,
  link        TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Paramètres admin ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Valeurs par défaut des paramètres email
INSERT INTO settings (key, value) VALUES
  ('smtp_host',      'smtp.gmail.com'),
  ('smtp_port',      '587'),
  ('smtp_user',      'collab@lotier-immobilier.com'),
  ('smtp_pass',      ''),
  ('smtp_from',      'Collab Lotier <collab@lotier-immobilier.com>'),
  ('notif_enabled',  'true')
ON CONFLICT (key) DO NOTHING;

-- ── Annonces / nouveautés ────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  version     TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Emails persistés ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_messages (
  id          TEXT PRIMARY KEY,
  uid         TEXT NOT NULL,
  "messageId" TEXT,
  folder      TEXT NOT NULL DEFAULT 'INBOX',
  "accountId" TEXT NOT NULL,
  "fromEmail" TEXT NOT NULL,
  "fromName"  TEXT,
  "toEmail"   TEXT NOT NULL DEFAULT '',
  subject     TEXT NOT NULL,
  "bodyText"  TEXT,
  "bodyHtml"  TEXT,
  date        TIMESTAMPTZ NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT false,
  starred     BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB,
  "threadId"  TEXT,
  labels      TEXT[] NOT NULL DEFAULT '{}',
  "senderType" TEXT,
  "senderId"  TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(uid, "accountId", folder)
);

-- ── Gestion locative ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS owners (
  id          TEXT PRIMARY KEY,
  prenom      TEXT NOT NULL,
  nom         TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenants (
  id          TEXT PRIMARY KEY,
  prenom      TEXT NOT NULL,
  nom         TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Trigger updatedAt ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW."updatedAt" = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at          ON tasks;
DROP TRIGGER IF EXISTS calendar_events_updated_at ON calendar_events;
DROP TRIGGER IF EXISTS settings_updated_at        ON settings;
DROP TRIGGER IF EXISTS owners_updated_at          ON owners;
DROP TRIGGER IF EXISTS tenants_updated_at         ON tenants;

CREATE TRIGGER tasks_updated_at           BEFORE UPDATE ON tasks           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER settings_updated_at        BEFORE UPDATE ON settings        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER owners_updated_at          BEFORE UPDATE ON owners          FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tenants_updated_at         BEFORE UPDATE ON tenants         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
