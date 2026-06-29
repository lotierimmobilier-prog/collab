# Robot de synchronisation Protexa → Collab

Récupère le nombre de **mandats signés par négociateur** (registre Transaction et
Gestion, **réservations et avenants exclus**, **cumul année civile en cours**)
depuis Protexa, et l'envoie à Collab pour affichage sur le tableau de bord.

À exécuter **sur le VPS** (qui a accès à Protexa), via un cron quotidien.

> ⚠️ **Sécurité** : les identifiants Protexa et le secret de synchro sont passés
> en **variables d'environnement**, jamais écrits dans le code ni commités.

---

## 1. Côté serveur Collab (une seule fois)

Ajouter le secret partagé dans le `.env.local` de Collab (sur le VPS) :

```bash
# valeur au hasard, par ex. : openssl rand -hex 24
PROTEXA_SYNC_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Puis redémarrer le conteneur Collab pour qu'il prenne la variable :

```bash
cd /chemin/vers/collab && docker compose -f docker-compose.vps.yml up -d
```

Sans `PROTEXA_SYNC_SECRET`, l'endpoint `/api/protexa/sync` répond « non configuré ».

---

## 2. Installation du robot (sur le VPS)

### Option A — Docker (recommandé, aucune dépendance système à gérer)

```bash
cd /chemin/vers/collab/scripts/protexa

# Image officielle Playwright (Chromium + libs déjà incluses)
docker run --rm \
  -e PROTEXA_LOGIN="VOTRE_LOGIN" \
  -e PROTEXA_PASS="VOTRE_MDP" \
  -e COLLAB_URL="https://collab.lotier-immobilier.com" \
  -e PROTEXA_SYNC_SECRET="le_meme_secret_que_collab" \
  -v "$PWD":/app -w /app \
  mcr.microsoft.com/playwright:v1.61.1-jammy \
  sh -c "npm install --no-save playwright && node sync.mjs"
```

### Option B — Node installé sur le VPS

```bash
cd /chemin/vers/collab/scripts/protexa
npm install
npx playwright install --with-deps chromium
PROTEXA_LOGIN=... PROTEXA_PASS=... COLLAB_URL=https://collab.lotier-immobilier.com \
PROTEXA_SYNC_SECRET=... node sync.mjs
```

---

## 3. Premier lancement = mode diagnostic

La page « Stats par tiers négociateurs » n'a pas pu être testée en développement.
Lance **une première fois avec `DIAG=1`** : le robot enregistre une capture
d'écran + le HTML de chaque étape dans `./diag/`.

```bash
DIAG=1 PROTEXA_LOGIN=... PROTEXA_PASS=... COLLAB_URL=... PROTEXA_SYNC_SECRET=... node sync.mjs
```

**Envoie-moi le contenu de `diag/`** (surtout `*-result.png`) : j'ajuste les
sélecteurs (onglet, lien du récap, sélecteur de période, lecture du tableau) si
besoin, et on fige la v1.

---

## 4. Cron quotidien (une fois la v1 validée)

Exemple : tous les jours à 6 h. Mettre les secrets dans un fichier
`/etc/collab/protexa.env` (lisible par root uniquement, `chmod 600`) :

```bash
# /etc/collab/protexa.env
PROTEXA_LOGIN=...
PROTEXA_PASS=...
COLLAB_URL=https://collab.lotier-immobilier.com
PROTEXA_SYNC_SECRET=...
```

`crontab -e` :

```cron
0 6 * * * cd /chemin/vers/collab/scripts/protexa && set -a && . /etc/collab/protexa.env && set +a && /usr/bin/node sync.mjs >> /var/log/protexa-sync.log 2>&1
```

(ou la commande `docker run …` de l'option A.)

---

## Variables d'environnement

| Variable              | Obligatoire | Rôle                                              |
|-----------------------|-------------|---------------------------------------------------|
| `PROTEXA_LOGIN`       | oui         | identifiant Protexa                               |
| `PROTEXA_PASS`        | oui         | mot de passe Protexa                              |
| `COLLAB_URL`          | oui         | URL publique de Collab                            |
| `PROTEXA_SYNC_SECRET` | oui         | secret partagé avec le serveur Collab             |
| `PROTEXA_BASE`        | non         | défaut `https://production.protexa.fr/ProtexaFullWeb` |
| `PROTEXA_YEAR`        | non         | année civile (défaut : année courante)            |
| `DIAG`                | non         | `1` = captures d'écran de diagnostic dans `diag/` |
| `HEADFUL`             | non         | `1` = navigateur visible (debug local)            |
