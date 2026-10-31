# Reco Croix-Rousse — Extension

Extension WebExtension (Chrome + Firefox) pour capturer rapidement un
événement vu sur le web vers un brouillon dans Reco Croix-Rousse. Voir
[docs/superpowers/specs/2026-10-30-reco-croixrousse-design.md](../docs/superpowers/specs/2026-10-30-reco-croixrousse-design.md)
pour le contexte complet.

## Charger l'extension en local

Aucune étape de build — les fichiers sous `extension/` sont chargés tels
quels.

**Chrome / Edge / Brave :**
1. Aller sur `chrome://extensions`.
2. Activer le "Mode développeur" (coin supérieur droit).
3. Cliquer "Charger l'extension non empaquetée" et sélectionner le dossier
   `extension/`.

**Firefox :**
1. Aller sur `about:debugging#/runtime/this-firefox`.
2. Cliquer "Charger un module complémentaire temporaire" et sélectionner
   `extension/manifest.json`.

## Configuration de l'API

L'URL de base de l'API backend se configure directement dans le popup de
l'extension (champ "URL de l'API" sur l'écran de connexion), et vaut par
défaut `http://localhost:8000`. Elle est stockée localement
(`browser.storage.local`), pas dans un fichier de config.

## CORS côté backend

Le backend n'acceptera les appels de l'extension que si son origine
(`chrome-extension://...` ou `moz-extension://...`) figure dans la variable
d'environnement `CORS_ORIGINS` du backend (voir
`backend/.env.example`). L'extension utilise une clé publique et un id
Firefox fixes (`manifest.json`) pour que ces origines restent stables d'un
rechargement à l'autre :

- Chrome : l'id dérivé de la clé fixe dans `manifest.json` est
  `bahglccliddlmejchlpnibhpkdkhabek` → origine
  `chrome-extension://bahglccliddlmejchlpnibhpkdkhabek`.
- Firefox : `browser_specific_settings.gecko.id` est
  `reco-croixrousse@dafflon.fr` → origine
  `moz-extension://reco-croixrousse@dafflon.fr`.

Ajouter ces deux origines à `CORS_ORIGINS` dans `backend/.env`, puis
redémarrer le serveur backend.

## Authentification

Connexion unique dans le popup (email + mot de passe d'un compte
admin/rédacteur). Les tokens (access + refresh) sont stockés localement.
**Il n'y a pas de rafraîchissement silencieux en arrière-plan** : un seul
essai de refresh est fait au moment d'un appel qui échoue en 401 ; si cet
essai échoue aussi (refresh token expiré, par défaut après
`JWT_REFRESH_EXPIRE_DAYS` = 30 jours), les tokens sont effacés et le popup
revient sur l'écran de connexion au prochain ouverture.
