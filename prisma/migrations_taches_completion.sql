-- ═══════════════════════════════════════════════════════════════
-- Migration : complétion des tâches (date/heure + utilisateur) — Collab
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_taches_completion.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "completedAt"   TIMESTAMP(3);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "completedById" TEXT;

-- Rétro-compatibilité : les tâches déjà au statut "done" sans date de
-- complétion reçoivent leur date de dernière mise à jour.
UPDATE tasks SET "completedAt" = "updatedAt"
WHERE status = 'done' AND "completedAt" IS NULL;
