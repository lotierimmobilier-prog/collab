#!/bin/bash
# deploy.sh — Déploiement sur VPS collab.lotier-immobilier.com
#
# USAGE :
#   chmod +x deploy.sh
#   ./deploy.sh
#
# PRÉREQUIS (une seule fois) :
#   echo 'LaMaisonDePalajaEstGrande2026+' > ~/.collab_vps_pass
#   chmod 600 ~/.collab_vps_pass
#
# Le mot de passe est lu depuis un fichier local (jamais dans les args CLI).

set -e

VPS_HOST="76.13.37.197"
VPS_USER="root"
APP_DIR="/var/www/collab"
PASS_FILE="$HOME/.collab_vps_pass"

# ── Vérifications ─────────────────────────────────────────────
if ! command -v sshpass &>/dev/null; then
  echo "❌ sshpass non installé. Installe-le : brew install hudochenkov/sshpass/sshpass"
  exit 1
fi

if [ ! -f "$PASS_FILE" ]; then
  echo "❌ Fichier de mot de passe manquant : $PASS_FILE"
  echo "   Crée-le avec : echo 'TON_MDP_VPS' > ~/.collab_vps_pass && chmod 600 ~/.collab_vps_pass"
  exit 1
fi

# ── 1. Push vers GitHub ───────────────────────────────────────
echo "📤 Push vers GitHub..."
git push origin main

# ── 2. Déploiement sur VPS ────────────────────────────────────
echo "🚀 Déploiement sur le VPS..."

sshpass -f "$PASS_FILE" ssh -o StrictHostKeyChecking=no "$VPS_USER@$VPS_HOST" bash <<'REMOTE'
  set -e
  echo "📂 Mise à jour du code..."
  cd /var/www/collab
  git pull origin main

  echo "📦 Installation des dépendances..."
  npm install --production=false

  echo "🔨 Build Next.js..."
  rm -rf .next
  npm run build

  echo "♻️  Redémarrage PM2..."
  pm2 restart collab || pm2 start npm --name "collab" -- start

  pm2 save
  echo "✅ Déploiement terminé !"
REMOTE

echo ""
echo "🌐 Site disponible : https://collab.lotier-immobilier.com"
