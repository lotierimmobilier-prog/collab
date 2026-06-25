# Déployer plus rapidement

La chaîne de déploiement comporte deux délais :

1. **Build GitHub Actions** (~3–6 min) : déclenché à chaque `push` sur `main`.
   Le cache Docker (`type=gha`) est déjà activé dans `.github/workflows/deploy.yml`,
   donc les builds suivants ne reconstruisent que ce qui a changé. C'est déjà
   optimisé.
2. **Récupération par Watchtower sur le VPS** : Watchtower interroge GHCR à
   intervalle régulier puis tire la nouvelle image et redémarre le conteneur.

## Ce qui a été changé (déjà appliqué)

`docker-compose.vps.yml` : intervalle Watchtower **180 s → 30 s**. Le VPS
récupère donc une nouvelle image dans les 30 s suivant la fin du build, au lieu
d'attendre jusqu'à 3 min.

Pour activer ce nouvel intervalle sur le VPS, recréer le conteneur Watchtower :

```bash
cd /var/www/collab
git pull
docker compose -f docker-compose.vps.yml up -d watchtower
```

## Option : déploiement instantané (déclenchement depuis GitHub Actions)

Pour supprimer complètement l'attente du sondage, Watchtower peut exposer une
API HTTP que GitHub Actions appelle juste après le push de l'image.

1. Démarrer Watchtower avec l'API activée (dans `docker-compose.vps.yml`) :

   ```yaml
   environment:
     - DOCKER_API_VERSION=1.44
     - WATCHTOWER_HTTP_API_UPDATE=true
     - WATCHTOWER_HTTP_API_TOKEN=${WATCHTOWER_TOKEN}
   ports:
     - "8080:8080"          # à ouvrir/filtrer côté pare-feu
   command: --http-api-update --cleanup --label-enable
   ```

2. Exposer `:8080` (idéalement derrière nginx en HTTPS, ou restreint par IP).

3. Ajouter un secret GitHub `WATCHTOWER_TOKEN` (et l'URL publique du VPS), puis
   une étape finale au workflow :

   ```yaml
   - name: Déclencher Watchtower
     run: |
       curl -sf -H "Authorization: Bearer ${{ secrets.WATCHTOWER_TOKEN }}" \
         https://VOTRE-DOMAINE/v1/update
   ```

Avec cette option, le redémarrage du conteneur démarre dès la fin du build,
sans aucun délai de sondage.

## Note

Seul un merge dans `main` déclenche un déploiement. Une Pull Request en cours
(brouillon) ne construit ni ne déploie tant qu'elle n'est pas fusionnée.
