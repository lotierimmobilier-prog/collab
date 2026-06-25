-- ═══════════════════════════════════════════════════════════════
-- Migration : téléphone utilisateur (profil) — Collab
-- À exécuter via :  psql "$DATABASE_URL" -f prisma/migrations_user_phone.sql
-- Additive et idempotente.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
