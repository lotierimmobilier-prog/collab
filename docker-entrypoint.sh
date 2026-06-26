#!/bin/sh
# ─────────────────────────────────────────────────────────────
# Entrée du conteneur Collab :
#  1. applique les migrations SQL (idempotentes) sur la base
#  2. démarre le serveur Next.js (standalone)
# ─────────────────────────────────────────────────────────────
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "✖ DATABASE_URL non défini — l'application ne peut pas démarrer." >&2
  exit 1
fi

run_sql() {
  if [ -f "$1" ]; then
    echo "  → $1"
    # On ne stoppe pas le démarrage si une migration déjà appliquée renvoie une
    # erreur bénigne ; les migrations Collab sont idempotentes (IF NOT EXISTS).
    psql "$DATABASE_URL" -f "$1" || echo "    (avertissement sur $1, ignoré)"
  fi
}

echo "▶ Application des migrations…"
run_sql prisma/migrations_vps.sql
run_sql prisma/migrations_annuaire.sql
run_sql prisma/migrations_cloisonnement.sql
run_sql prisma/migrations_taches_completion.sql
run_sql prisma/migrations_auguste_logs.sql
run_sql prisma/migrations_user_phone.sql
run_sql prisma/migrations_performance.sql
run_sql prisma/migrations_internal_attachments.sql
run_sql prisma/migrations_direction.sql
run_sql prisma/migrations_comptabilite.sql
run_sql prisma/migrations_vehicle_details.sql
run_sql prisma/migrations_premise_details.sql
run_sql prisma/migrations_task_recurrence.sql
run_sql prisma/migrations_direction_meetings.sql
run_sql prisma/migrations_ics.sql

echo "▶ Démarrage de Collab sur le port ${PORT:-3000}…"
exec node server.js
