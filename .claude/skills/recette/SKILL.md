---
name: recette
description: Recette d'un lot de l'application triathlon selon CLAUDE.md. À utiliser quand je demande de faire la recette, de valider un lot, de dérouler les tests d'acceptation ou de vérifier qu'un lot est terminé.
argument-hint: [lot, par exemple V1.1]
---

# Recette du lot $ARGUMENTS

Si aucun lot n'est précisé, prends le lot en cours (sections 9 et 11 de CLAUDE.md).

## 1. Contrôles automatiques
- Lance `node --test` : tous les tests doivent passer.
- Vérifie que chaque test automatique listé dans les tests d'acceptation du lot existe. S'il en manque, écris-le.
- Vérifie les imports : chaque nom importé doit être réellement exporté par le module cible.

## 2. Contrôles de règles (lecture du code)
- Couches : `ui/` ne fait aucun calcul métier ; seule `db/` accède à IndexedDB ; `calculs/` et `regles/` ne contiennent que des fonctions pures.
- Périmètre : rien n'est codé en dehors des fonctions du lot.
- Traçabilité : chaque fonction codée cite son identifiant (F-xx, ENF-xx, C-xx).
- Confidentialité (ENF-21, ENF-22) : aucune URL externe, aucun script, police ou appel réseau vers un service tiers.
- Textes : messages identiques à ceux de CLAUDE.md (M-xx) ; bornes conformes à ENF-20.
- `VERSION` dans `sw.js` et `VERSION_APP` sont cohérentes.

## 3. Contrôle dans le navigateur
- Lance `python -m http.server 8000` et ouvre http://localhost:8000.
- Si le skill webapp-testing est disponible, utilise-le pour vérifier : aucune erreur dans la console, navigation entre les écrans, parcours principaux du lot.
- Arrête le serveur à la fin.

## 4. Rapport
Produis un tableau en français reprenant les tests d'acceptation du lot :
| Réf. | Test | Résultat (✅ / ❌ / 👤 à faire par moi) | Remarque |
- 👤 = tests qui nécessitent un vrai téléphone (installation, mode avion, Android, iPhone).
- Liste ensuite les corrections nécessaires, sans les faire sauf si je le demande.
