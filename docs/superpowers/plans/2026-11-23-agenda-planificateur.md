# Extension L8 : agenda du planificateur, horaires, graphique des séances - plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** heure facultative sur les séances (types et manuelles), semaine type affichée en grille horaire dans le planificateur, graphique des blocs dans l'éditeur, l'aperçu du plan et la Séance du jour.

**Architecture :** fonctions pures nouvelles dans `logique/grille.js` (disposition de la grille) et `logique/graphique-seance.js` (barres du graphique) ; heure portée par l'objet séance (`heure: 'hh:mm' | null`), écrite dans `start_date_local` des événements et dans une étiquette `heure-hh:mm` des séances de bibliothèque ; composant SVG `graphiqueSeance` dans `ui/composants.js`.

**Tech Stack :** HTML/CSS/JS natifs, modules ES, `node --test`.

**Spec :** `docs/superpowers/specs/2026-11-23-agenda-planificateur-design.md` (complète `2026-11-23-objectif-semaine-type-design.md`).

## Global Constraints

- Règles de CLAUDE.md section 0 (couches, français, traçabilité F-xx, pas de caractères typographiques spéciaux, `VERSION`/`VERSION_APP` incrémentées, `node --test` vert, commit en français).
- Grille : 7 colonnes lundi à dimanche, de 5 h à 23 h, 1 h = 48 px, bloc d'au moins 24 px de haut, zone touchable d'au moins 44 px ; séance sans durée = 1 h ; séances qui se chevauchent un même jour = largeur partagée ; ligne « Sans heure » en haut (repos compris).
- Heure : facultative, format `hh:mm` 24 h ; stockée en étiquette `heure-hh:mm` sur la séance de bibliothèque ; envoyée dans `start_date_local` (`AAAA-MM-JJThh:mm:00`, `T00:00:00` sans heure) ; un événement lu à `00:00` = sans heure.
- Graphique : largeur = durée ; hauteur et couleur = zone (1 à 5, couleurs `.zone-Z1` à `.zone-Z5` existantes) ; répétitions dépliées ; étape sans zone = barre basse grise ; étape en distance convertie avec l'allure seuil, sinon avec une allure par défaut (CAP 3 m/s, VELO 8 m/s, NATATION 1 m/s, autres 3 m/s) et barre hachurée (`estimee: true`).
- Traçabilité : F-31/F-40/F-43/F-44 (heure des séances manuelles), F-81 (grille, heure des séances types), F-85 (heure envoyée), F-41/F-84/F-20 (graphique).

## Review Focus

1. Séance à 22:30 qui dure 1 h : le bloc est coupé à 23 h sans déborder de la grille. Test : Task 2 `bloc coupé en fin de grille`.
2. Séance avant 5 h (ex. 04:30) : le bloc commence en haut de la grille. Test : Task 2 `bloc avant 5 h`.
3. Trois séances dont deux se chevauchent le même jour : seules les deux qui se chevauchent partagent la colonne. Test : Task 2 `chevauchement partiel`.
4. Déplacer une séance manuelle (F-44) garde son heure. Test : Task 1 `corps de déplacement avec heure`.
5. Séance structurée vide ou sans durée : le graphique ne plante pas et renvoie une liste vide. Test : Task 3 `séance sans étape`.

---

### Task 1 : heure des séances (F-40, F-43, F-44, F-81, F-85)

**Files :**
- Modify : `js/logique/seance.js` (`validerSeance` contrôle `heure`), `js/api/evenements.js`, `js/api/semaine-type.js`, `js/logique/plan.js` (ordre par heure dans un jour), `js/ui/composants.js` (`carteSeancePrevue` affiche l'heure), `js/ui/accueil.js` (Séance du jour affiche l'heure), `js/ui/programmer.js` (champ Heure dans les deux modes, paramètre `heure` de `#/seance-type/nouvelle?jour=N&heure=hh:mm`)
- Test : `tests/api.test.js`, `tests/semaine-type.test.js`, `tests/plan.test.js`, `tests/seance.test.js`

**Interfaces :**
- Produces :
  - SeancePrevue et séance type : champ `heure: 'hh:mm' | null`.
  - `versEvenement(s)` : `start_date_local = ${date}T${heure ?? '00:00'}:00`.
  - `convertirSeancePrevue(brut).heure` : `start_date_local.slice(11, 16)`, `null` si vide ou `00:00`.
  - `corpsDeplacement(date, heure) -> { start_date_local }` exporté par `api/evenements.js` ; `deplacerSeance(id, date, heure = null)`.
  - `versSeanceBibliotheque` ajoute l'étiquette `heure-hh:mm` si `heure` ; `convertirSeanceType` relit `heure`.
  - `genererPlan` : séances d'un jour triées par heure (sans heure en premier), puis ordre de la semaine type ; l'heure est recopiée.
  - `validerSeance` : erreur `heure` si `heure` n'est ni null ni `hh:mm` valide (00:00 à 23:59).

- [ ] **Step 1 : tests**
  - `versEvenement({ date: '2026-11-25', heure: '18:30', sport: 'CAP', titre: 'Footing', duree_s: 2700, blocs: [] }).start_date_local === '2026-11-25T18:30:00'` ; sans heure `'2026-11-25T00:00:00'`.
  - `convertirSeancePrevue({ ..., start_date_local: '2026-11-25T18:30:00' }).heure === '18:30'` ; à `T00:00:00` -> `null`.
  - `corps de déplacement avec heure` : `corpsDeplacement('2026-11-27', '07:15')` -> `{ start_date_local: '2026-11-27T07:15:00' }`.
  - aller-retour bibliothèque avec heure (étiquettes `['semaine-type', 'jour-2', 'heure-18:30']`) et sans heure (pas d'étiquette heure, `heure: null`).
  - `genererPlan` : séances du mardi à `18:30` et `07:00` sortent dans l'ordre `07:00`, `18:30`, et `external_id` suit cet ordre ; `heure` conservée.
  - `validerSeance({ ...valide, heure: '25:00' }).heure` existe ; `heure: null` et `'06:05'` valides.
- [ ] **Step 2 : `node --test`** : échecs attendus sur ces tests.
- [ ] **Step 3 : implémenter** (les tests existants qui comparent un objet complet reçoivent `heure: null`).
- [ ] **Step 4 : `node --test`** vert.
- [ ] **Step 5 : commit** `L8 : heure des séances (F-40, F-43, F-44, F-81, F-85)`.

### Task 2 : grille hebdomadaire du planificateur (F-81)

**Files :**
- Create : `js/logique/grille.js`
- Modify : `js/ui/objectif.js` (section Semaine type), `css/style.css`
- Test : `tests/grille.test.js`

**Interfaces :**
- Consumes : séance type avec `jour`, `heure` (Task 1) ; `volumeSeance_s` (`logique/plan.js`).
- Produces :
  - `GRILLE = { heureDebut: 5, heureFin: 23, pxParHeure: 48, hauteurMin: 24 }`
  - `dispositionSemaine(seances, allures = {}) -> { blocs: [{ seance, jour, haut_px, hauteur_px, colonne, nbColonnes }], sansHeure: seance[] }` ; repos et séances sans heure dans `sansHeure` ; durée = `volumeSeance_s`, ou 3600 si 0 ; haut coupé à 0, bas coupé à `(heureFin - heureDebut) * pxParHeure` ; hauteur au moins `hauteurMin` ; chevauchement : groupes de séances qui se chevauchent (transitivement) un même jour, colonnes attribuées dans l'ordre des heures, `nbColonnes` = colonnes du groupe.
  - `heureDepuisPosition(y_px) -> 'hh:00'` (heure pleine de la case touchée, bornée à la grille).

- [ ] **Step 1 : tests**
  - séance mardi 18:30 de 1 h -> `{ jour: 2, haut_px: 648, hauteur_px: 48, colonne: 0, nbColonnes: 1 }`.
  - `bloc coupé en fin de grille` : 22:30, 1 h -> `haut_px 840`, `hauteur_px 24`.
  - `bloc avant 5 h` : 04:30, 1 h -> `haut_px 0`, `hauteur_px 24` (fin à 5:30 -> 24 px).
  - `chevauchement partiel` : mardi 18:00-19:00, 18:30-19:30, 20:00-21:00 -> colonnes 0/1 avec `nbColonnes` 2, puis colonne 0 avec `nbColonnes` 1.
  - séance de 10 min -> `hauteur_px 24` ; séance simple sans durée -> 48 px ; repos et sans heure -> `sansHeure`.
  - `heureDepuisPosition(0) === '05:00'`, `(650) === '18:00'`, `(5000) === '22:00'`.
- [ ] **Step 2 : `node --test tests/grille.test.js`** : échec (module absent).
- [ ] **Step 3 : implémenter `logique/grille.js`** ; puis remplacer la liste de la section Semaine type par la grille : en-tête des jours, ligne « Sans heure » (liens), colonne des heures, 7 colonnes ; bloc = lien `#/seance-type/{id}` (icône, heure, titre tronqué), positionné par `element.style` (top, height, left, width en % de colonne) après rendu (CSP) ; un toucher dans une colonne vide ouvre `#/seance-type/nouvelle?jour=N&heure=` + `heureDepuisPosition(y)` ; la carte défile verticalement (hauteur 480 px), défilée à 6 h au premier affichage.
- [ ] **Step 4 : `node --test`** vert ; recette navigateur : grille visible, toucher d'une case vide ouvre l'éditeur avec jour et heure préremplis, bloc ouvre la séance, largeur 390 px sans défilement horizontal.
- [ ] **Step 5 : commit** `L8 : grille hebdomadaire du planificateur (F-81)`.

### Task 3 : graphique des blocs (F-41, F-84, F-20)

**Files :**
- Create : `js/logique/graphique-seance.js`
- Modify : `js/ui/composants.js` (`graphiqueSeance`), `js/ui/programmer.js` (sous l'aperçu, mis à jour par `majApercu`), `js/ui/objectif.js` (chaque séance d'une semaine dépliée), `js/ui/accueil.js` (Séance du jour), `css/style.css`, `sw.js`, `js/version.js`, `CLAUDE.md`
- Test : `tests/graphique-seance.test.js`

**Interfaces :**
- Produces :
  - `ALLURES_PAR_DEFAUT = { CAP: 3, VELO: 8, NATATION: 1, AUTRE: 3 }` (m/s)
  - `barresSeance(seance, allures = {}) -> { barres: [{ debut_s, duree_s, zone: 1..5|null, estimee: boolean }], total_s }` ; séance structurée : étapes dans l'ordre, répétitions dépliées (effort puis récupération, n fois) ; séance simple avec durée : une barre sans zone ; repos ou sans étape : `{ barres: [], total_s: 0 }`.
  - `graphiqueSeance(seance, allures, { compact = false }) -> string` (SVG `viewBox` 0 0 300 80, compact 0 0 300 40 ; barre : `x` et `width` en proportion de `total_s`, `height` = zone/5 de la hauteur, sans zone = 0,15 ; classe `barre-Z{n}` ou `barre-sans-zone`, plus `barre-estimee` ; `role="img"` et `aria-label` « Profil de la séance, {durée} ») ; `''` si aucune barre.

- [ ] **Step 1 : tests**
  - séance « 15 min Z2, 5 x (4 min Z4 + 2 min Z1), 10 min Z1 » -> 12 barres, `total_s` 3300, barre 2 `{ debut_s: 900, duree_s: 240, zone: 4, estimee: false }`.
  - étape `{ distance_m: 1000, zone: 3 }` en course : avec `{ CAP: 4 }` -> `duree_s 250, estimee false` ; sans allure -> `duree_s 333` (arrondi), `estimee true`.
  - séance simple `duree_s 3600` -> une barre `zone null`.
  - `séance sans étape` : `{ sport: 'CAP', blocs: [] }` et repos -> `{ barres: [], total_s: 0 }`.
- [ ] **Step 2 : `node --test tests/graphique-seance.test.js`** : échec.
- [ ] **Step 3 : implémenter** ; brancher le graphique aux trois endroits (allures du profil en cache dans l'éditeur et le planificateur, `{}` sur l'accueil) ; CSS : `.barre-Z1` à `.barre-Z5` (couleurs de `.zone-Z1` à `.zone-Z5`), `.barre-sans-zone` gris, `.barre-estimee` hachurée (`fill-opacity` réduite et motif SVG défini dans le composant).
- [ ] **Step 4 : `node --test`**, imports, recette navigateur (graphique dans l'éditeur qui change quand on modifie les répétitions, dans l'aperçu du plan, sur l'accueil ; aucune erreur console) ; `VERSION` v2.0.10 ; CLAUDE.md : journal D-19 (choix de la spec), 9.1 (paramètre `heure` de l'éditeur de séance type).
- [ ] **Step 5 : commit** `L8 : graphique des séances (F-41, F-84, F-20)`.
