# Déploiement automatisé de Collab (Docker + GitHub Actions + Watchtower)

Pipeline (comme demandé) :
**push sur `main` → GitHub Actions construit l'image → GHCR → Watchtower (VPS) la récupère → le conteneur applique les migrations puis démarre.**

---

## 1. Côté GitHub (une fois)

Dans **Settings → Secrets and variables → Actions**, ajoute le secret :

| Secret | Valeur |
|--------|--------|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | l'ID client Google (nécessaire **au build** car injecté dans le bundle) |

> Le `GITHUB_TOKEN` est automatique : le workflow pousse l'image vers `ghcr.io/lotierimmobilier-prog/collab`.

Après le 1ᵉʳ build, rends le package GHCR accessible au VPS (ou garde-le privé et authentifie le VPS, voir §3).

---

## 2. Côté VPS — fichiers

```bash
mkdir -p /opt/collab && cd /opt/collab
# Récupère docker-compose.vps.yml depuis le repo (renomme en docker-compose.yml)
curl -fsSL -o docker-compose.yml \
  https://raw.githubusercontent.com/lotierimmobilier-prog/collab/main/docker-compose.vps.yml
```

Crée le fichier **`/opt/collab/.env`** :
```
DATABASE_URL=postgresql://collab_user:...@HOTE:5432/collab_db
AUTH_SECRET=...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...
NODE_ENV=production
```
> Si la base tourne sur le VPS hôte (hors Docker), utilise `@172.17.0.1:5432` ou `@host.docker.internal` comme hôte dans `DATABASE_URL`.

---

## 3. Côté VPS — authentification GHCR (image privée)

```bash
echo "<TON_GITHUB_PAT_read:packages>" | docker login ghcr.io -u <ton_user_github> --password-stdin
```
(Crée un PAT GitHub avec le scope `read:packages`.) Le `~/.docker/config.json` ainsi créé est monté en lecture par Watchtower.

---

## 4. Démarrage

```bash
cd /opt/collab
docker compose up -d
docker compose logs -f app    # vérifie : migrations appliquées + "Démarrage de Collab"
```

À chaque push sur `main`, Watchtower (poll 180 s) récupère la nouvelle image et redémarre le conteneur, qui **rejoue les migrations idempotentes** avant de démarrer.

---

## 5. nginx (reverse proxy + TLS)

Le conteneur écoute sur `127.0.0.1:3000`. Garde ta config nginx existante pour `collab.lotier-immobilier.com` → `proxy_pass http://127.0.0.1:3000;`.

---

## Notes / migration depuis le déploiement manuel

- L'ancien `deploy.sh` (sshpass + pm2) n'est plus nécessaire une fois ce pipeline en place. Arrête le process pm2 : `pm2 delete collab`.
- Les migrations restent des fichiers SQL **idempotents** (`prisma/migrations_*.sql`), appliqués automatiquement à chaque démarrage du conteneur par `docker-entrypoint.sh`. Pour ajouter une migration : déposer un nouveau `prisma/migrations_<nom>.sql` (en `IF NOT EXISTS`) et l'ajouter à la liste de l'entrypoint.
- ⚠️ Le build Docker n'a pas pu être testé dans l'environnement de dev : surveille le 1ᵉʳ run GitHub Actions et envoie-moi l'erreur éventuelle, je corrige.
