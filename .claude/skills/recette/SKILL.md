---
name: recette
description: Recette d'un lot de l'application triathlon selon CLAUDE.md (CDC v2.0, Intervals.icu). À utiliser quand je demande de faire la recette, de valider un lot, de dérouler les tests d'acceptation ou de vérifier qu'un lot est terminé.
argument-hint: [lot, par exemple L1]
---

# Recette du lot $ARGUMENTS

Si aucun lot n'est précisé, prends le lot en cours (sections 6, 9.7 et 11 de CLAUDE.md).
CLAUDE.md fait foi : en cas d'écart avec ce fichier, suis CLAUDE.md.

## 1. Contrôles automatiques
- Lance `node --test` : tous les tests doivent passer.
- Vérifie que chaque fonction pure du lot (dossier `js/logique/` et conversions de `js/api/`) a ses tests (ENF-24). S'il en manque, écris-les.
- Vérifie les imports : chaque nom importé doit être réellement exporté par le module cible.

## 2. Contrôles de règles (lecture du code)
- Couches (5.3) : `ui/` ne calcule rien et n'appelle pas le réseau ; seule `api/` appelle Intervals.icu ; seule `cache/` accède à IndexedDB ; `logique/` ne contient que des fonctions pures.
- Objets internes (9.2, ENF-25) : l'affichage ne manipule jamais les réponses brutes de l'API.
- Noms d'endpoints et de champs Intervals.icu : vérifiés dans la documentation officielle (5.6), jamais devinés.
- Périmètre : rien n'est codé en dehors des fonctions du lot.
- Traçabilité : chaque fonction codée cite son identifiant (F-xx, ENF-xx).
- Sécurité (0.3, ENF-12, ENF-13, D-21) :
  - `tests/securite.test.js` passe (motifs de secrets, `.gitignore`, liens externes, échappement des données dans `ui/`) ;
  - clé API absente du code, de git (`git log -p` du lot), de la console, de l'affichage, des URL et du cache du service worker ;
  - toute donnée de l'API ou de l'adresse insérée dans le HTML passe par `echapperHtml` ; tout paramètre d'adresse est vérifié avant usage ; aucun `eval`, `new Function`, `setTimeout` avec une chaîne ni attribut `on...` ;
  - CSP d'`index.html` inchangée ou plus stricte : pas de `'unsafe-inline'` ni de `'unsafe-eval'`, `connect-src` et `img-src` limités aux domaines d'ENF-12 ; aucune ressource externe (script, police, CSS, image) ;
  - le service worker ne met en cache que les fichiers de l'appli ; « Se déconnecter » efface identifiants et cache ;
  - toute nouvelle suppression ou tout nouveau remplacement de séances demande une confirmation et ne vise que les séances créées par l'appli ;
  - aucune nouvelle tentative automatique sans limite vers Intervals.icu ;
  - tests avec des données inventées uniquement ; aucune donnée personnelle (vraies activités, captures, traces GPS) dans le dépôt, `docs/` compris ;
  - `package.json` sans dépendance inutile ni script `postinstall`.
- Textes : messages identiques à la section 9.5 (M-xx) ; formats conformes à 9.4 ; couleurs et icônes des sports conformes à 9.3.
- Pas de caractères typographiques spéciaux (tirets longs, guillemets courbes) dans le code et le HTML.
- `VERSION` dans `sw.js` et `VERSION_APP` sont identiques.

## 3. Contrôle dans le navigateur
- Lance `python -m http.server 8000 --bind 127.0.0.1` depuis le dossier du projet et ouvre http://localhost:8000.
- Ne jamais utiliser ni demander la vraie clé API : simuler les réponses d'Intervals.icu (interception des requêtes) avec des données conformes à la documentation.
- Vérifier : aucune erreur dans la console, navigation entre les écrans, parcours principaux du lot, états chargement, vide, erreur réseau et erreur d'identifiants (ENF-22), largeur 360 à 1920 px sans défilement horizontal, zones cliquables ≥ 44 px.
- Réseau : aucune requête hors des domaines autorisés (ENF-12) ; clé absente de la console.
- Arrête le serveur à la fin.

## 4. Rapport
Produis un tableau en français reprenant les fonctions et exigences du lot et son critère d'acceptation (9.7) :
| Réf. | Test | Résultat (✅ / ❌ / 👤 à faire par moi) | Remarque |
- 👤 = tests qui demandent ma vraie clé, mon téléphone ou ma montre.
- Liste ensuite exactement ce que je dois tester moi-même, puis les corrections nécessaires, sans les faire sauf si je le demande.
