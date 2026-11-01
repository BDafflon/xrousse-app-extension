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

Le backend n'acceptera les appels de l'extension que si son origine est
autorisée :

- Chrome : origine stable, dérivée de la clé publique fixe dans
  `manifest.json` → `chrome-extension://bahglccliddlmejchlpnibhpkdkhabek`.
  Cette origine doit figurer explicitement dans `CORS_ORIGINS` (voir
  `backend/.env.example`).
- Firefox : l'origine `moz-extension://<uuid>` est un UUID aléatoire par
  installation (le `gecko.id` fixé dans `manifest.json` n'influence pas cet
  UUID), donc elle ne peut pas être listée à l'avance dans `CORS_ORIGINS`.
  Le backend autorise tout le schéma `moz-extension://` via
  `allow_origin_regex` (`backend/app/main.py`), en plus de la liste exacte
  `CORS_ORIGINS` utilisée pour les autres origines (frontend, Chrome).

Ajouter l'origine Chrome ci-dessus à `CORS_ORIGINS` dans `backend/.env`,
puis redémarrer le serveur backend.

## Authentification

Connexion unique dans le popup (email + mot de passe d'un compte
admin/rédacteur). Les tokens (access + refresh) sont stockés localement.
**Il n'y a pas de rafraîchissement silencieux en arrière-plan** : un seul
essai de refresh est fait au moment d'un appel qui échoue en 401 ; si cet
essai échoue aussi (refresh token expiré, par défaut après
`JWT_REFRESH_EXPIRE_DAYS` = 30 jours), les tokens sont effacés et le popup
revient sur l'écran de connexion au prochain ouverture.

## Publication sur addons.mozilla.org (AMO)

1. Créer un compte développeur sur
   [addons.mozilla.org/developers](https://addons.mozilla.org/developers/).
2. Préparer le zip de l'extension : à la racine du dossier `extension/`
   (pas un sous-dossier), zipper uniquement les fichiers nécessaires au
   runtime (exclure `.git/`, `.superpowers/`, et tout fichier de dev) :
   ```
   cd extension
   zip -r ../reco-croixrousse-firefox.zip . \
     -x ".git/*" ".superpowers/*" ".gitignore"
   ```
3. Sur AMO, "Soumettre un nouveau module" → choisir "On this site"
   (listing public) ou "On your own" (auto-distribution, pas de review
   publique mais signature quand même requise) selon l'usage visé.
4. Uploader le zip. AMO lance une validation automatique (lint du
   manifest, permissions, code). Pour une extension qui n'est pas destinée
   au grand public (usage interne équipe), choisir "Unlisted" évite la
   review manuelle complète tout en obtenant une version signée
   installable de façon permanente.
5. Renseigner la fiche (description longue, catégorie, captures d'écran)
   si listing public ; sinon ces champs sont optionnels pour "Unlisted".
6. Vérifier avant soumission :
   - `version` dans `manifest.json` doit être incrémentée à chaque upload
     (AMO refuse une version déjà utilisée).
   - `browser_specific_settings.gecko.id` doit rester stable entre les
     versions (c'est l'identifiant qui lie les mises à jour entre elles).
   - Les permissions demandées (`storage`, `contextMenus`, `activeTab`,
     `notifications`, `scripting`, `windows`) doivent être cohérentes avec
     ce que fait réellement le code : AMO peut demander une justification
     en review manuelle si une permission semble large par rapport à
     l'usage (`scripting` notamment attire souvent une question).
   - `host_permissions: ["<all_urls>"]` est nécessaire pour l'action
     "Utiliser cette image" : le background télécharge l'image depuis
     n'importe quel site, ce qu'un `fetch` cross-origin sans host
     permission bloque via CORS. À justifier en review AMO.
   - Le champ `data_collection_permissions` est déjà renseigné à `none`
     dans `manifest.json` ; il doit refléter la réalité (l'extension ne
     doit alors faire aucun appel vers un service tiers autre que l'API
     backend configurée par l'utilisateur).
7. Une fois approuvée, AMO fournit un `.xpi` signé. C'est ce fichier
   (et non le zip source) qui doit être distribué pour une installation
   permanente — Firefox refuse les extensions non signées en dehors du
   mode développeur/Nightly.
8. Pour les mises à jour futures : incrémenter `version`, régénérer le
   zip, et soumettre une nouvelle version sur la même fiche AMO (pas un
   nouveau listing).
