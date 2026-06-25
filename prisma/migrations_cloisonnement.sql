-- ═══════════════════════════════════════════════════════════════
-- Migration cloisonnement par utilisateur — Collab Lotier Immobilier
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_cloisonnement.sql
-- Additive et idempotente (réexécutable sans risque).
-- ═══════════════════════════════════════════════════════════════

-- Tâches : créateur (visibilité assigné OU créateur)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "createdById" TEXT;
CREATE INDEX IF NOT EXISTS "tasks_assigneeId_idx"  ON tasks("assigneeId");
CREATE INDEX IF NOT EXISTS "tasks_createdById_idx" ON tasks("createdById");

-- Mails : propriétaire (agent de la boîte) pour le cloisonnement
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
CREATE INDEX IF NOT EXISTS "email_messages_ownerId_idx" ON email_messages("ownerId");

-- Rattachement des boîtes existantes à leur agent : si le créateur n'est PAS
-- admin, il devient l'agent assigné de sa propre boîte (préserve l'accès actuel).
-- Les boîtes créées par un admin restent SANS agent → l'admin devra les assigner
-- à l'agent concerné (il ne doit pas accéder au contenu).
UPDATE mail_account_configs mac
SET "sharedUserIds" = array_append(mac."sharedUserIds", mac."createdBy")
FROM users u
WHERE mac."createdBy" = u.id
  AND u."roleId" <> 'admin'
  AND NOT (mac."createdBy" = ANY(mac."sharedUserIds"));

-- Étiquetage rétroactif des mails existants par l'agent (1er) de leur boîte.
-- Les mails de boîtes non encore assignées restent sans ownerId.
UPDATE email_messages em
SET "ownerId" = mac."sharedUserIds"[1]
FROM mail_account_configs mac
WHERE em."accountId" = mac.id
  AND em."ownerId" IS NULL
  AND array_length(mac."sharedUserIds", 1) >= 1;
