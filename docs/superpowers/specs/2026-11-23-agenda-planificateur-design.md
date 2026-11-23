# Conception courte : agenda hebdomadaire du planificateur, horaires, graphique des séances (extension du lot L8)

Date : 23/11/2026. Statut : à valider par Quentin. Complète `2026-11-23-objectif-semaine-type-design.md`.

## Intention
Dans le planificateur (écran Objectif et plan), Quentin veut **voir et construire sa semaine type comme un agenda**, avec **l'heure de chaque séance**, pour caser l'entraînement autour de son emploi du temps. Il veut aussi **voir la forme de chaque séance** (le graphique des blocs) partout où elle apparaît dans le programme.

## Approche (choisie)
Une seule voie raisonnable dans le cadre du projet :
- **Grille en HTML/CSS** : les blocs sont de vrais liens, faciles à toucher (ENF-17) et lisibles ; une grille SVG rendrait le toucher et l'accessibilité difficiles ; une bibliothèque de calendrier est interdite (ENF-26).
- **Graphique en SVG** : net en petit comme en grand, comme la courbe du tableau de bord.
- **Calculs en fonctions pures testées** (position des blocs, barres du graphique, horaire envoyé).

## Ce qui est décidé
1. **Grille hebdomadaire** (remplace la liste de la section Semaine type) : 7 colonnes du lundi au dimanche, de **5 h à 23 h**, défilement vertical dans la carte. Une séance = un bloc placé à son heure, hauteur = sa durée, couleur et icône du sport. Toucher un bloc ouvre la séance type ; **toucher une case vide** crée une séance type à ce jour et à cette heure (heure pleine).
2. **Heure d'une séance type** : champ facultatif (hh:mm) dans l'éditeur. Sans heure, la séance est rangée dans une ligne « Sans heure » en haut de la grille ; un repos y est aussi.
3. **Plan** : chaque séance générée reprend l'heure de sa séance type et part dans Intervals.icu à cette heure (`start_date_local` avec l'heure).
4. **Graphique des blocs** à trois endroits : éditeur de séance (mis à jour en direct), aperçu du plan (séances d'une semaine dépliée, donc surchargées), carte « Séance du jour » de l'accueil. Largeur = durée ; hauteur et couleur = zone (couleurs des zones du détail d'activité) ; répétitions dépliées ; étape sans zone = barre basse grise ; étape en distance convertie avec l'allure seuil, sinon largeur par défaut et barre hachurée.

## Mes choix (à vérifier)
- **Taille** : 1 h = 48 px (un bloc d'une heure se touche facilement) ; un bloc fait au moins 24 px de haut, et la zone touchable au moins 44 px.
- **Chevauchement** : deux séances qui se chevauchent un même jour se partagent la largeur de la colonne.
- **Stockage de l'heure** : étiquette `heure-hh:mm` sur la séance de bibliothèque (le modèle Workout n'a pas de champ d'heure).
- **Séances programmées à la main (L4)** : elles reçoivent aussi un champ Heure facultatif, et l'heure s'affiche sur les cartes de séance prévue (« 18:30 · Course · 55 min »). Même code, même règle partout.
- **Durée sans précision** (séance simple sans durée) : bloc d'1 h dans la grille.

## Non-objectifs
- Heures dans la vue semaine de l'Agenda sous forme de grille ; glisser-déposer d'un bloc ; heure prise en compte par la montre.

## Laissé à la construction
- Noms des fonctions (`logique/grille.js`, `logique/profil-seance.js` ou dans `logique/seance.js`), découpage des composants, styles.
- Vérifier dans la spécification qu'un `start_date_local` avec heure est accepté pour un événement (sinon : heure seulement dans l'appli).
