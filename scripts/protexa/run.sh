#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lance le robot Protexa → Collab SUR LE VPS, via Docker (image Playwright
# officielle : Chromium + libs déjà incluses, rien à installer sur l'hôte).
#
# Les secrets sont lus depuis un fichier d'environnement (par défaut
# /etc/collab/protexa.env), jamais passés en clair sur la ligne de commande.
#
# Usage :
#   ./run.sh            # synchronisation normale (à mettre en cron)
#   ./run.sh diag       # mode diagnostic : captures d'écran dans ./diag
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="${PROTEXA_ENV_FILE:-/etc/collab/protexa.env}"
DIR="$(cd "$(dirname "$0")" && pwd)"
PW_IMAGE="mcr.microsoft.com/playwright:v1.61.1-jammy"

if [ ! -f "$ENV_FILE" ]; then
  echo "✖ Fichier de secrets introuvable : $ENV_FILE"
  echo "  Crée-le à partir de protexa.env.example (voir README.md)."
  exit 1
fi

DIAG_FLAG=""
if [ "${1:-}" = "diag" ]; then DIAG_FLAG="-e DIAG=1"; echo "▶ Mode diagnostic (captures dans $DIR/diag)"; fi

exec docker run --rm \
  --env-file "$ENV_FILE" \
  $DIAG_FLAG \
  -v "$DIR":/app -w /app \
  "$PW_IMAGE" \
  sh -c "npm install --no-save playwright@1.61.1 >/dev/null 2>&1 && node sync.mjs"
