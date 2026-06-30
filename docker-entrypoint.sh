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

# ── URL compatible psql/libpq ────────────────────────────────────────────
# Prisma ajoute à DATABASE_URL des paramètres qui lui sont propres
# (schema, connection_limit, pgbouncer, pool_timeout, sslaccept…). libpq
# (psql) REFUSE ces paramètres inconnus et la connexion échoue → les
# migrations ne s'appliquaient pas. On reconstruit une URL épurée pour psql,
# en conservant uniquement les paramètres compris par libpq, et en traduisant
# « schema= » en search_path.
build_psql_url() {
  _url="$1"
  _base="${_url%%\?*}"
  _query=""
  case "$_url" in *\?*) _query="${_url#*\?}" ;; esac
  _keep=""
  _schema=""
  OLDIFS="$IFS"; IFS='&'
  for _kv in $_query; do
    case "$_kv" in
      schema=*) _schema="${_kv#schema=}" ;;
      sslmode=*|sslrootcert=*|sslcert=*|sslkey=*|sslpassword=*|connect_timeout=*|application_name=*|options=*|target_session_attrs=*)
        _keep="${_keep:+$_keep&}$_kv" ;;
    esac
  done
  IFS="$OLDIFS"
  if [ -n "$_schema" ] && [ "$_schema" != "public" ]; then
    export PGOPTIONS="--search_path=$_schema,public"
  fi
  if [ -n "$_keep" ]; then echo "$_base?$_keep"; else echo "$_base"; fi
}

PSQL_URL="$(build_psql_url "$DATABASE_URL")"

echo "▶ Vérification de la connexion psql…"
if psql "$PSQL_URL" -tAc 'SELECT 1' >/dev/null 2>&1; then
  echo "  ✓ Connexion psql OK — les migrations vont être appliquées."
else
  echo "  ✖ psql ne parvient pas à se connecter — voir l'URL. Démarrage quand même." >&2
fi

run_sql() {
  if [ -f "$1" ]; then
    echo "  → $1"
    # On ne stoppe pas le démarrage si une migration déjà appliquée renvoie une
    # erreur bénigne ; les migrations Collab sont idempotentes (IF NOT EXISTS).
    psql "$PSQL_URL" -f "$1" >/dev/null 2>&1 \
      && echo "    ✓ ok" \
      || echo "    (avertissement sur $1, ignoré)"
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
run_sql prisma/migrations_activity.sql
run_sql prisma/migrations_gestion_ics.sql
run_sql prisma/migrations_formation.sql
run_sql prisma/migrations_formation_questions.sql
run_sql prisma/migrations_fournisseurs.sql
run_sql prisma/migrations_ods_detail.sql
run_sql prisma/migrations_assistance.sql
run_sql prisma/migrations_ods_exchange.sql
run_sql prisma/migrations_personal_space.sql
run_sql prisma/migrations_supplier_insurance.sql
run_sql prisma/migrations_supplier_conformite.sql
run_sql prisma/migrations_procedures.sql
run_sql prisma/migrations_procedures_roles.sql
run_sql prisma/migrations_rh.sql
run_sql prisma/migrations_rh_decompte.sql
run_sql prisma/migrations_user_employee.sql
run_sql prisma/migrations_employee_dossier.sql
run_sql prisma/migrations_google_calendar.sql
run_sql prisma/migrations_user_city.sql
run_sql prisma/migrations_mail_uploads.sql
run_sql prisma/migrations_user_extras.sql
run_sql prisma/migrations_user_superadmin.sql
run_sql prisma/migrations_mail_public_views.sql
run_sql prisma/migrations_mail_blocklist.sql
run_sql prisma/migrations_mail_signatures.sql
run_sql prisma/migrations_client_portal.sql
run_sql prisma/migrations_tenant_documents.sql
run_sql prisma/migrations_insurance_tracking.sql
run_sql prisma/migrations_client_prefs.sql
run_sql prisma/migrations_formation_nudges.sql
run_sql prisma/migrations_training_resources.sql
run_sql prisma/migrations_drive_governance.sql
run_sql prisma/migrations_user_menu.sql
run_sql prisma/migrations_portal_listings.sql
run_sql prisma/migrations_drive_template_parent.sql
run_sql prisma/migrations_auguste_tokens.sql
run_sql prisma/migrations_protexa_mandates.sql
run_sql prisma/migrations_suggestions.sql
run_sql prisma/migrations_shop.sql
run_sql prisma/migrations_ai_agents.sql
run_sql prisma/migrations_ai_agents_cv.sql
run_sql prisma/migrations_ai_agents_more.sql
run_sql prisma/migrations_ai_agents_trio.sql
run_sql prisma/migrations_password_setup.sql

echo "▶ Démarrage de Collab sur le port ${PORT:-3000}…"
exec node server.js
