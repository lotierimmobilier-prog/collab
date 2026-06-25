-- ═══════════════════════════════════════════════════════════════
-- Migration cloisonnement par utilisateur — Collab Lotier Immobilier
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_cloisonnement.sql
-- Additive et idempotente (réexécutable sans risque).
-- ═══════════════════════════════════════════════════════════════

-- Tâches : créateur (visibilité assigné OU créateur)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "createdById" TEXT;
CREATE INDEX IF NOT EXISTS "tasks_assigneeId_idx"  ON tasks("assigneeId");
CREATE INDEX IF NOT EXISTS "tasks_createdById_idx" ON tasks("createdById");

-- Mails : propriétaire (utilisateur ayant synchronisé/envoyé) pour le cloisonnement
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
CREATE INDEX IF NOT EXISTS "email_messages_ownerId_idx" ON email_messages("ownerId");
