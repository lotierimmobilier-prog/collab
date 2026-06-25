-- ═══════════════════════════════════════════════════════════════
-- Migration : récurrence des tâches — Collab
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_task_recurrence.sql
-- Additive et idempotente.
-- Si « must be owner of table tasks », exécuter en superutilisateur :
--   sudo -u postgres psql -d collab_db -c 'ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT;'
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence TEXT;
