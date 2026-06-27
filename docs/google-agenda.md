# Google Agenda — connexion permanente (sync serveur)

L'agenda Google est désormais synchronisé **côté serveur** : on se connecte une
seule fois, puis l'agenda reste affiché en permanence (planning + tableau de
bord, en temps réel) sans avoir à se reconnecter. Auguste peut aussi le lire.

## Ce qu'il faut configurer (une fois)

La connexion utilise OAuth 2.0 « offline » : il faut un **secret client** Google,
en plus de l'identifiant client déjà présent.

### 1. Google Cloud Console
1. Console → *APIs & Services* → *Credentials*.
2. Ouvrir (ou créer) le client OAuth de type **« Application Web »**.
3. Dans **URI de redirection autorisés**, ajouter :
   `https://collab.lotier-immobilier.com/api/google/calendar/callback`
4. Noter l'**ID client** et le **secret client**.
5. *APIs & Services* → *Library* → activer **Google Calendar API**.
6. Écran de consentement OAuth : ajouter le scope
   `.../auth/calendar.readonly` et publier l'application (ou ajouter les
   utilisateurs en testeurs).

### 2. Variables d'environnement (VPS / déploiement)
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<id client>
GOOGLE_CLIENT_SECRET=<secret client>
NEXTAUTH_URL=https://collab.lotier-immobilier.com   # déjà défini normalement
AUTH_SECRET=<déjà défini>                            # sert au chiffrement du refresh_token
```
Le `refresh_token` est stocké **chiffré** (AES-256-GCM, clé dérivée de
`AUTH_SECRET`) — jamais en clair, jamais committé.

## Utilisation
- Planning → bouton **« Connecter Google »** (ou panneau « Agendas Google »).
- Choisir les agendas à afficher (interrupteurs).
- Tout est ensuite automatique : les événements apparaissent dans le planning et
  sur le tableau de bord, rafraîchis périodiquement.

## En cas d'erreur « sans autorisation hors-ligne »
Google ne renvoie le `refresh_token` qu'au premier consentement. Si l'accès
avait déjà été accordé autrement : compte Google →
*Sécurité* → *Applications tierces* → révoquer « Collab », puis reconnecter.
