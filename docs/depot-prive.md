# Passer le dépôt en privé (sans casser le déploiement)

Objectif : retirer l'accès public au code tout en continuant à déployer
normalement (GitHub Actions → image GHCR → Watchtower sur le VPS).

## 1. Rendre le dépôt privé
GitHub → dépôt **collab** → **Settings** → onglet **General** → tout en bas,
**Danger Zone** → **Change repository visibility** → **Make private** →
confirmer en tapant le nom du dépôt.

> Le workflow GitHub Actions (build + push de l'image) continue de
> fonctionner en privé : il utilise le `GITHUB_TOKEN` interne.

## 2. Rendre l'image Docker (GHCR) privée
La visibilité de l'image est **indépendante** de celle du code.
GitHub → profil / organisation → **Packages** → **collab** →
**Package settings** → **Change visibility** → **Private**.

## 3. Authentifier le VPS pour tirer l'image privée
Le `docker-compose.vps.yml` monte déjà `~/.docker/config.json` dans
Watchtower. Il suffit que le serveur soit connecté à GHCR. **Une seule
fois**, sur le VPS :

```bash
echo "TON_TOKEN_GHCR" | docker login ghcr.io -u lotierimmobilier-prog --password-stdin
```

- `TON_TOKEN_GHCR` = un **Personal Access Token (classic)** avec la
  permission **`read:packages`**.
  Création : GitHub → **Settings** → **Developer settings** →
  **Personal access tokens** → **Tokens (classic)** → **Generate new token**.

Après ça, Watchtower continue de déployer les nouvelles images
automatiquement, comme avant.

## Ce qui ne change pas
- Les Pull Requests, merges et déploiements fonctionnent à l'identique.
- L'accès de l'assistant (Claude Code) reste valable : la session est déjà
  autorisée sur le dépôt, privé ou public.

## Seul point d'attention : minutes GitHub Actions
- Dépôt **public** : Actions **illimité**.
- Dépôt **privé** : **2 000 minutes/mois gratuites**.
  Un build prend ~2 à 4 min → environ **500 à 1 000 déploiements/mois**.
  Large dans la pratique, mais à garder en tête si tu enchaînes beaucoup
  de merges.
