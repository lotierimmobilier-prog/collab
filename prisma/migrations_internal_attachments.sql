-- ═══════════════════════════════════════════════════════════════
-- Migration : pièces jointes des messages internes — Collab
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_internal_attachments.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE internal_messages ADD COLUMN IF NOT EXISTS attachments JSONB;

-- Purge initiale : retire les pièces jointes de plus de 30 jours.
UPDATE internal_messages
   SET attachments = NULL
 WHERE attachments IS NOT NULL
   AND "createdAt" < now() - INTERVAL '30 days';
