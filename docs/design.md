# Système de design E

> Décision D-20 (24/11/2026), validée sur les maquettes `docs/maquettes/E-Accueil.dc.html` et `docs/maquettes/E-Activites.dc.html`.
> Les variables CSS correspondantes sont en tête de `css/style.css`. Tout nouvel écran suit ce document.

## 1. Direction

Fond noir type écran de montre, police **Archivo** très grasse pour les chiffres, cartes discrètes, **couleur réservée aux sports**.

- Les chiffres sont la vedette : grands, très gras, à chasse fixe (`tabular-nums`).
- Les cartes ne crient pas : fond à peine plus clair que la page, filet de 1 px, pas d'ombre.
- La couleur n'apparaît que pour désigner un sport. Le reste de l'interface est en noir, blanc et gris.
  Seule exception : le rouge des erreurs et des actions de suppression (toujours accompagné d'une icône ou d'un texte).

## 2. Couleurs

### 2.1 Interface

| Rôle | Variable | Sombre (défaut) | Clair |
|---|---|---|---|
| Fond de page | `--fond` | `#0A0B0C` | `#F4F5F6` |
| Carte | `--carte` | `#121417` | `#FFFFFF` |
| Élément posé sur une carte (barre vide, champ) | `--carte-2` | `#1A1D21` | `#EEF0F2` |
| Filet des cartes | `--filet` | `#1E2124` | `#E1E4E7` |
| Bord de la barre de navigation, contours des boutons | `--filet-fort` | `#2A2E32` | `#CDD2D7` |
| Texte | `--texte` | `#EDEEEF` | `#0A0B0C` |
| Texte secondaire | `--texte-2` | `#8B9197` | `#5B6168` |
| Texte sur fond clair (bouton principal, filtre actif) | `--sur-clair` | `#0A0B0C` | `#FFFFFF` |
| Texte sur une couleur de sport (bloc « Aujourd'hui ») | `--sur-sport` | `#0A0B0C` | `#FFFFFF` |
| Erreur, suppression | `--danger` | `#FF6B6B` | `#C62828` |

En mode clair, les fonds « clairs » du mode sombre deviennent foncés : le bouton principal, le filtre actif et le bouton central de la navigation sont noirs avec un texte blanc.

### 2.2 Sports (section 9.3 de CLAUDE.md)

| Sport | Classe | Sombre | Clair | Icône |
|---|---|---|---|---|
| Course | `sport-CAP` | `#3DDC84` | `#0B7F43` | coureur |
| Vélo | `sport-VELO` | `#FF7A1A` | `#C2410C` | vélo |
| Natation | `sport-NATATION` | `#3FA7FF` | `#0B6BC2` | nageur et vagues |
| Renfo | `sport-RENFO` | `#B98CFF` | `#7C3AED` | haltère |
| Enchaînement | `sport-ENCHAINEMENT` | `#FFD23F` | `#8A6A00` | flèches en boucle |
| Repos | `sport-REPOS` | `#A3ABB3` | `#5F6870` | lune |
| Autre | `sport-AUTRE` | `#F28CC6` | `#B0307A` | étoile |

La classe `sport-XXX` pose la variable `--couleur-sport`, que les composants utilisent (texte, icône, point, barre, bord pointillé).
Les couleurs sombres sont aussi dans `js/logique/sports.js` (champ `couleur`). La carte Leaflet lit la variable pour suivre le thème.

### 2.3 Données

- **Jauge de forme** (Fatigue, En charge, Équilibré, Frais) : sombre `#6B2E2E`, `#5C4A26`, `#3D5A2A`, `#2C4A5E` ; clair `#F0C4C4`, `#EBDAB0`, `#C9E2BC`, `#BBD6EA`. Le repère est à la couleur du texte.
- **Zones d'intensité** (graphiques de séance, temps par zone) : Z1 gris bleu, Z2 vert, Z3 jaune, Z4 orange, Z5 rouge, Z6 et Z7 violet (variables `--zone-1` à `--zone-6`). Ce sont des données, pas des sports : elles gardent leur code couleur habituel.
- **Types de semaine du plan** : nuances neutres (texte, texte secondaire, hachures). Le type est toujours écrit en toutes lettres.

### 2.4 Contrastes (ENF-19 : au moins 4,5:1)

Calculés selon la formule WCAG 2.1.

| Paire | Sombre | Clair |
|---|---|---|
| Texte sur carte | 15,9 | 19,7 |
| Texte secondaire sur carte | 5,8 | 6,3 |
| Texte secondaire sur fond | 6,2 | 5,7 |
| Couleur de sport la plus faible sur carte | Vélo 7,1 | Enchaînement 5,1 |
| Couleur de sport la plus faible sur fond | Vélo 7,6 | Enchaînement 4,6 |
| Texte sur couleur de sport (bloc « Aujourd'hui ») | au moins 7,6 | au moins 5,1 |
| Erreur sur carte | 6,7 | 5,6 |

## 3. Typographie

- **Police** : Archivo (graisses 500, 700, 800, 900), servie depuis `fonts/archivo-variable.woff2`, avec `system-ui` en secours.
  Fichier tiré du dépôt officiel Google Fonts (`ofl/archivo`), réduit à l'axe de graisse 500-900 (largeur 100) et aux caractères latins, converti en woff2. Licence : `fonts/OFL.txt` (SIL Open Font License 1.1).
  Aucune police n'est téléchargée depuis Internet (ENF-21) ; la CSP autorise seulement `font-src 'self'`.
- **Texte courant** : 16 px, graisse 500.
- **Chiffres** : graisse 900, `letter-spacing` de -0,02em à -0,03em, `font-variant-numeric: tabular-nums`.
  Tailles : 44 px (bloc « Aujourd'hui »), 40 px (TSB), 30 px (tuiles, dernière activité), 28 px (cartes du fil), 22 px (statistiques).
  L'unité suit en petit : 12 px, graisse 500, couleur secondaire (`48,38 km`).
- **Libellés** : 12 à 13 px, graisse 800, majuscules, `letter-spacing` 0,08em, couleur secondaire (`.etiquette-carte`, étiquettes des champs).
  Le titre d'une carte (`h2`) suit la même règle, en couleur de texte.
- **Titre d'écran** : 34 px, graisse 900, majuscules, `letter-spacing` -0,03em (`ACTIVITÉS`). Écran avec bouton retour : 20 px, centré.

## 4. Espacements et formes

| Élément | Valeur |
|---|---|
| Rayon des cartes, boutons, filtres, champs | 6 px (`--rayon`) |
| Padding des cartes | 14 px 16 px |
| Espacement entre les blocs | 12 px (`--espace`) |
| Marges latérales | 16 px (`--marge`) |
| Zone cliquable minimale | 44 x 44 px (ENF-17) ; boutons pleine largeur 48 px |
| Largeur maximale du contenu | 640 px |

## 5. Icônes

- SVG en ligne, dessinées en local dans `js/ui/icones.js` (et dans `index.html` pour la barre de navigation).
- Grille 24 x 24, trait 2 px (2,2 px dans la navigation), extrémités arrondies, couleur `currentColor`.
- Décoratives (`aria-hidden`) : le sens est porté par un texte visible ou un `aria-label`.
- **Aucun emoji nulle part.**

## 6. Composants

### Bloc « Aujourd'hui » (F-20)
Fond = couleur du sport de la séance du jour, texte `--sur-sport`. Ligne de libellé en majuscules (`AUJOURD'HUI · COURSE`), titre de la séance en 44 px graisse 900 majuscules, durée à droite (h:mm), détail dessous (heure, distance, graphique des blocs en une seule teinte ou description). Sans séance : bloc Repos avec un bouton « Programmer une séance ».

### Carte d'activité (F-11, F-21)
Sport en majuscules dans sa couleur, avec son icône, puis le titre ; date (et heure) à droite en secondaire. Chiffres clés en grand (distance, durée), vitesse ou allure et charge en second (18 px, secondaire).
Variante de l'accueil : chiffres en colonnes (30 px) avec leur unité ou leur libellé dessous, date `Dernière activité · jj/mm`.

### Carte Forme (F-23)
TSB en 40 px + phrase de la section 9.4 ; CTL et ATL en haut à droite ; jauge de 4 segments (Fatigue, En charge, Équilibré, Frais) avec un repère. Position du repère : `positionJauge` (`js/logique/forme.js`), linéaire dans chaque segment entre les bornes de 9.4.

### Tuile Mois (F-22)
Heures du mois en grand, écart avec le mois précédent à la même date (▲ ou ▼), courbe du cumul en SVG (mois en cours en trait plein, mois précédent en pointillés).

### Tuile Semaine (F-25)
Réalisé en grand (h:mm) « sur X prévues », puis une ligne par sport : icône, barre de progression à la couleur du sport, réalisé / prévu.

### Barre de navigation (9.1)
Pilule flottante de 64 px de haut, à 22 px du bas, fond carte et filet `--filet-fort`, rayon 32 px. Cinq icônes sans texte avec `aria-label` (Accueil, Agenda, Programmer, Activités, Profil). Onglet actif en `--texte`, inactifs en secondaire. Bouton central rond de 48 px sur fond clair.

### Filtres et choix
Boutons au rayon 6 px, fond carte et filet ; actif sur fond clair avec texte noir. Les bascules (Simple / Structurée, Durée / Distance, vues de l'agenda) suivent la même règle.

### Boutons
- Principal : fond `--texte`, texte `--sur-clair`.
- Secondaire : fond carte, contour `--filet-fort`.
- Danger : fond transparent, contour et texte `--danger`.
- Bouton d'icône (en-têtes) : carré de 44 px, rayon 6 px, fond carte.

### Messages (ENF-22)
Carte discrète avec une icône à gauche (succès, info, erreur). Seule l'erreur est en couleur (contour et icône `--danger`).

### Séance prévue (F-32)
Carte transparente avec un bord pointillé de 2 px à la couleur du sport ; le réalisé est une carte pleine.

## 7. Thèmes (ENF-16)

- Sombre par défaut. Le mode clair s'applique quand le téléphone est en mode clair (`prefers-color-scheme: light`) : mêmes règles, couleurs du tableau 2.
- Choix manuel dans Réglages (D-23) : Automatique, Clair ou Sombre. Le choix pose `data-theme="clair"` ou `"sombre"` sur `<html>` ; les jetons clairs sont définis à la fois sous la media query (sauf `data-theme="sombre"`) et sous `:root[data-theme="clair"]`. Toute nouvelle règle propre à un thème doit couvrir les deux cas.
