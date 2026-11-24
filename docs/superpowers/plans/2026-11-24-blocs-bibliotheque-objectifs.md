# Bibliothèque de séances, blocs à contenu propre, objectifs de course : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** remplacer la semaine type unique du lot L8 par une bibliothèque « Mes séances » et des blocs ayant chacun leur grille, avec un volume qui continue de monter de bloc en bloc, une migration qui ne change pas le plan en cours, et la saisie des objectifs de course par discipline.

**Architecture :** les calculs (volumes par bloc, calendrier à rebours, édition des blocs, migration, objectifs de course) sont des fonctions pures dans `js/logique/blocs.js` et `js/logique/objectifs-course.js`. `js/api/preparation.js` remplace `js/api/semaine-type.js` : séances = séances de bibliothèque du dossier, blocs et réglages = JSON dans la description du dossier. L'écran E-09 est découpé : `ui/objectif.js` (écran), `ui/blocs.js` (onglets et grille d'un bloc), `ui/placement.js` (choisir une séance pour une case, modifier un emplacement).

**Tech Stack :** HTML/CSS/JS sans framework, modules ES natifs, `node --test`, API Intervals.icu, Playwright (Edge) dans le venv du dossier de travail pour la vérification navigateur.

**Spec :** `docs/superpowers/specs/2026-11-24-blocs-bibliotheque-objectifs-design.md`

## Global Constraints
- Toutes les règles de `CLAUDE.md` (0.1 à 0.4) : français, couches (`ui/` sans calcul ni réseau, `logique/` pure, `api/` seule à appeler Intervals.icu, `cache/` seule à toucher IndexedDB), traçabilité F-xx dans les commentaires, pas de tirets longs ni guillemets courbes, imports vérifiés.
- Sécurité 0.3 : toute donnée insérée dans le HTML passe par `echapperHtml` (contrôlé par `tests/securite.test.js`), paramètres d'adresse vérifiés, suppression ou remplacement dans Intervals.icu après `confirm`, données inventées dans les tests.
- Champs d'API : seulement ceux déjà utilisés ou vérifiés dans la spécification (`Folder.description`, `WorkoutEx.tags/folder_id/name/type/description/moving_time/distance`, `EventEx.description`, `EventEx.time_target`).
- Envoi du plan, étiquette `external_id` `plan-{objectif}-s{n}-{date}-{i}`, garde-fou d'étiquette, bornes de régénération et de suppression : inchangés (`api/plan.js` n'est pas modifié).
- Hors ligne : lecture depuis le cache, boutons d'écriture `.ecriture` désactivés (M-04, ENF-07).
- Valeurs par défaut des réglages : hausse 8, coupure 70, affûtage [70, 50], plafond null.
- Formats de course (m) : XS 400 / 10000 / 2500 ; S 750 / 20000 / 5000 ; M 1500 / 40000 / 10000 ; 70.3 1900 / 90000 / 21100 ; Ironman 3800 / 180000 / 42200.
- Fin de chaque tâche : `node --test` vert, commit en français citant les identifiants ; `VERSION` et `VERSION_APP` incrémentés une fois, dans la dernière tâche.

## Review Focus
1. **Séance supprimée sur le site** (emplacement qui pointe vers un identifiant absent) : ignorée dans la grille, le volume, le plan et l'aperçu, sans erreur. Test : tâche 1 (`grilleDuBloc`) et tâche 2 (`utilisationsSeance`).
2. **Bloc sans volume** (vide, ou seulement repos ou séances sans durée) : message « Le bloc {nom} est vide », pas de NaN ni d'Infinity dans le plan. Test : tâche 1 (`blocsVides`).
3. **Description du dossier corrompue** (en-tête du nouveau format présent mais JSON illisible) : erreur affichée, **aucune migration ni écriture** qui écraserait les blocs. Test : tâche 4 (`texteVersPreparation`).
4. **Deux appareils** : chaque écriture relit la préparation (lecture forcée) puis applique la modification, pour ne pas effacer un bloc modifié ailleurs. Test : tâche 4 (`modifierPreparation` avec réponses simulées).
5. **Objectifs saisis en partie ou mal saisis** : total absent si une partie manque, message par champ invalide, texte libre de la description de la course conservé. Test : tâche 5 (`tempsTotal`, `lireObjectifsSaisis`, `fusionnerDescription`).

---

## Modèle de données (référence pour toutes les tâches)
```js
// Séance de la bibliothèque (objet interne, comme la séance type actuelle, sans jour ni heure significatifs)
{ id, sport, titre, duree_s, distance_m, description, blocs, jour, heure } // jour/heure = anciennes étiquettes, lues seulement par la migration
// Emplacement d'une séance dans un bloc
{ seanceId: '123', jour: 1..7, heure: 'hh:mm' | null }
// Bloc ; coupure absent = règle de la conception (coupure sauf pour le dernier bloc), booléen = forcé (migration)
{ nom: 'Endurance', semaines: 4, emplacements: [...], coupure?: true | false }
// Réglages
{ hausse: 8, coupure: 70, affutage: [70, 50], plafond_h: null }
// Préparation (lue par api/preparation.js)
{ dossierId, seances: [...], reglages, blocs: [...] | null, ancienFormat: { reglages } | null }
// Objectifs de course (dans l'objectif : o.objectifs)
{ format: 'XS'|'S'|'M'|'70.3'|'IRONMAN'|'PERSO'|null,
  segments: { NATATION?: { distance_m, temps_s }, T1?: { temps_s }, VELO?: {...}, T2?: { temps_s }, CAP?: {...} } }
```

---

### Task 1 : calcul du plan par blocs (F-83, F-84)

**Files :**
- Create : `js/logique/blocs.js`
- Test : `tests/blocs.test.js`

**Interfaces :**
- Consumes : `surchargerSeance`, `volumeSemaine_s`, `externalId`, `REGLAGES_PAR_DEFAUT` (`js/logique/plan.js`) ; `lundiDe`, `ajouterJours` (`js/logique/dates.js`) ; l'ancien `genererPlan` reste présent jusqu'à la tâche 8 pour comparer.
- Produces :
  - `grilleDuBloc(bloc, seances) -> [{ ...seance, jour, heure }]` : séances des emplacements, dans l'ordre des emplacements, emplacements orphelins ignorés.
  - `blocsVides(blocs, seances, allures) -> number[]` : index des blocs dont la grille a un volume nul.
  - `coefficientsBlocs(blocs, volumes_s, reglages) -> [{ numero, type: 'HAUSSE'|'COUPURE'|'AFFUTAGE'|'COURSE', bloc: index, pct, pctSeances }]`.
  - `debutDesBlocs(dateCourse, nbSemaines) -> 'AAAA-MM-JJ'` (lundi de la première semaine).
  - `genererPlanBlocs({ seances, blocs, reglages, dateCourse, allures, objectifId }) -> [{ numero, type, pct, bloc, nomBloc, lundi, seances, volume_s }]` ; `nomBloc` = nom du bloc, `'Affûtage'` ou `'Course'` pour les semaines d'affûtage.

Règles de `coefficientsBlocs` (pourcentages du volume de la grille du bloc 1, mêmes arrondis que `coefficientsPlan`) :
```
base = volumes_s[0] ; pctMax = plafond ? round(plafond_h*3600/base*100) : Infinity
depart = 100
pour chaque bloc i (n semaines) :
  avecCoupure = bloc.coupure ?? (i < dernier)
  pour j de 0 à n-1 :
    si avecCoupure et j == n-1 : COUPURE, pct = round(pct précédent * coupure / 100)
    sinon : HAUSSE, pct = min(depart + j*hausse, pctMax) ; derniereHausse = pct
  depart = derniereHausse
pour chaque niveau d'affûtage : AFFUTAGE, bloc = dernier, pct = round(derniereHausse * niveau / 100)
dernière semaine : type COURSE
pctSeances = pct * volumes_s[0] / volumes_s[bloc]
```

- [ ] **Step 1 : tests qui échouent** (`tests/blocs.test.js`)
```js
test('deux blocs de 4 semaines, affûtage 70/50 : le volume continue de monter', () => {
  const c = coefficientsBlocs([{ nom: 'A', semaines: 4 }, { nom: 'B', semaines: 4 }], [21600, 18000], { hausse: 8, coupure: 70, affutage: [70, 50], plafond_h: null });
  assert.deepEqual(c.map((s) => s.pct), [100, 108, 116, 81, 116, 124, 132, 140, 98, 70]);
  assert.deepEqual(c.map((s) => s.type), ['HAUSSE', 'HAUSSE', 'HAUSSE', 'COUPURE', 'HAUSSE', 'HAUSSE', 'HAUSSE', 'HAUSSE', 'AFFUTAGE', 'COURSE']);
  assert.deepEqual(c.map((s) => s.bloc), [0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  assert.equal(c[4].pctSeances, 116 * 21600 / 18000); // grille du bloc 2 mise à l'échelle : 7 h
});
test('coupure forcée sur le dernier bloc (migration)', () => {
  const c = coefficientsBlocs([{ nom: 'A', semaines: 4, coupure: true }], [3600], { hausse: 8, coupure: 70, affutage: [70], plafond_h: null });
  assert.deepEqual(c.map((s) => s.pct), [100, 108, 116, 81, 81]);
});
test('plafond en heures', () => { /* base 3600, plafond 1.1 h -> pct max 110 : [100, 108, 110, ...] */ });
test('sans affûtage : la dernière semaine du dernier bloc est la semaine de course', () => { /* type COURSE en dernier */ });
test('début : lundis comptés à rebours depuis la semaine de la course', () => {
  assert.equal(debutDesBlocs('2027-02-21', 10), '2026-12-21'); // course un dimanche, 10 semaines
});
test('revue 1 : emplacement orphelin ignoré', () => {
  const g = grilleDuBloc({ emplacements: [{ seanceId: 'x', jour: 2, heure: null }, { seanceId: 'a', jour: 3, heure: '18:30' }] }, [{ id: 'a', sport: 'CAP', titre: 'EF', duree_s: 3600 }]);
  assert.deepEqual(g.map((s) => [s.id, s.jour, s.heure]), [['a', 3, '18:30']]);
});
test('revue 2 : bloc vide ou sans volume signalé', () => {
  assert.deepEqual(blocsVides([{ emplacements: [] }, { emplacements: [{ seanceId: 'r', jour: 1, heure: null }] }, { emplacements: [{ seanceId: 'a', jour: 1, heure: null }] }],
    [{ id: 'r', sport: 'REPOS', titre: 'Repos' }, { id: 'a', sport: 'CAP', titre: 'EF', duree_s: 3600 }], {}), [0, 1]);
});
test('genererPlanBlocs : même séance placée deux fois, noms des blocs, titres S{n}, rien après la course', () => { /* deux emplacements de la même séance un même bloc -> deux séances la même semaine ; nomBloc 'Endurance', 'Affûtage', 'Course' ; titre 'EF S1' ; dates < dateCourse */ });
test("non-régression : un bloc unique de la même grille donne le même plan que l'ancien genererPlan", () => {
  // grille de 3 séances, objectif 'o1', course 2027-02-21, reglages anciens { hausse: 8, semainesHausse: 3, coupure: 70, affutage: [70, 50], plafond_h: null, debut: '2026-11-30' }
  // ancien = genererPlan(...) ; nouveau = genererPlanBlocs avec les blocs [4, 4, 4(sans coupure, reste)] tirés du même calendrier
  // assert.deepEqual sur [lundi, pct, seances.map(external_id, titre, duree_s, date)] pour chaque semaine
});
```
- [ ] **Step 2 :** `node --test tests/blocs.test.js` -> Expected : FAIL (module absent).
- [ ] **Step 3 :** implémenter les cinq fonctions dans `js/logique/blocs.js`. `genererPlanBlocs` reprend l'ordre de `genererPlan` (jour, heure, sans heure en premier, puis ordre des emplacements) en factorisant dans `plan.js` une fonction exportée `seancesDeLaSemaine(grille, lundi, pct, numero, dateCourse, objectifId) -> séances` que `genererPlan` et `genererPlanBlocs` appellent tous deux.
- [ ] **Step 4 :** `node --test` -> Expected : tout passe (les anciens tests de `plan.test.js` aussi).
- [ ] **Step 5 :** commit `L8 : calcul du plan par blocs (F-83, F-84)`.

### Task 2 : édition des blocs et réglages (F-82, F-88)

**Files :**
- Modify : `js/logique/blocs.js`, `js/logique/plan.js` (`REGLAGES_PAR_DEFAUT`, `validerReglages`, `lireReglagesSaisis`)
- Test : `tests/blocs.test.js`, `tests/plan.test.js`

**Interfaces :**
- Produces (toutes pures, renvoient une **nouvelle** liste de blocs, l'entrée n'est pas modifiée) :
  - `ajouterBloc(blocs, nom) -> blocs` (nouveau bloc de 4 semaines, vide, à la fin)
  - `dupliquerBloc(blocs, index) -> blocs` (copie juste après, nom « {nom} (copie) », emplacements copiés, sans `coupure`)
  - `supprimerBloc(blocs, index)`, `modifierBloc(blocs, index, { nom, semaines })`
  - `ajouterEmplacement(blocs, index, emplacement)`, `modifierEmplacement(blocs, index, n, { jour, heure })`, `retirerEmplacement(blocs, index, n)`
  - `retirerSeanceDesBlocs(blocs, seanceId) -> blocs`
  - `utilisationsSeance(blocs, seanceId) -> number` (nombre de blocs qui l'utilisent)
  - `validerBlocs(blocs) -> { 'blocs.i.nom'?: msg, 'blocs.i.semaines'?: msg, blocs?: msg }` : au moins un bloc ; nom non vide, 40 caractères au plus ; semaines entier de 1 à 20 ; heure d'emplacement `hh:mm` ou null ; jour 1 à 7.
  - `REGLAGES_PAR_DEFAUT = { hausse: 8, coupure: 70, affutage: [70, 50], plafond_h: null }` ; `validerReglages` et `lireReglagesSaisis` sans `semainesHausse` ni `debut`.
- [ ] **Step 1 : tests qui échouent** : un test par fonction ci-dessus, avec au moins : `dupliquerBloc` insère après l'index et copie les emplacements ; `retirerSeanceDesBlocs` retire toutes les occurrences dans tous les blocs ; `utilisationsSeance` compte des blocs (une séance placée deux fois dans un bloc = 1) ; l'entrée n'est pas modifiée (`assert.deepEqual(avant, copieAvant)`) ; `validerBlocs([])` -> `{ blocs: 'Ajoute au moins un bloc.' }` ; `validerBlocs([{ nom: '', semaines: 0, emplacements: [] }])` signale nom et semaines ; `validerReglages` n'exige plus `debut` ni `semainesHausse`.
- [ ] **Step 2 :** `node --test` -> Expected : FAIL sur les nouveaux tests.
- [ ] **Step 3 :** implémenter ; mettre à jour les tests existants de `plan.test.js` qui attendaient `semainesHausse`/`debut` dans `validerReglages` et `lireReglagesSaisis` (changement d'interface voulu par la conception 5.3 et 5.4).
- [ ] **Step 4 :** `node --test` -> Expected : tout passe.
- [ ] **Step 5 :** commit `L8 : édition des blocs et réglages communs (F-82, F-88)`.

### Task 3 : migration fidèle de la semaine type (F-88, conception 5.8)

**Files :**
- Modify : `js/logique/blocs.js`
- Test : `tests/blocs.test.js`

**Interfaces :**
- Consumes : `lundisDuPlan`, `debutEffectif`, `lundiSuivant` (`plan.js`).
- Produces : `migrerAncienFormat({ seances, reglagesAnciens, objectif, aujourdhui }) -> { reglages, blocs }`
  - `emplacements` = `seances.map((s) => ({ seanceId: s.id, jour: s.jour, heure: s.heure }))`, dans l'ordre reçu ;
  - `reglages` = `{ hausse, coupure, affutage, plafond_h }` des anciens réglages ;
  - sans objectif : un bloc « Bloc 1 » de `semainesHausse + 1` semaines ;
  - avec objectif : `debut = debutEffectif(reglagesAnciens, objectif.id, lundiSuivant(aujourdhui))`, `nb = lundisDuPlan(debut, objectif.date).length`, `reste = nb - min(affutage.length, nb)` ; découper `reste` en blocs « Bloc 1 », « Bloc 2 »... de `semainesHausse + 1` semaines, le dernier prenant le reste ; si le dernier bloc a exactement `semainesHausse + 1` semaines (cycle complet, qui finissait par une coupure), lui mettre `coupure: true` ; si `reste` vaut 0, un seul bloc d'une semaine (cas d'un plan plus court que l'affûtage, voir Step 1).
- [ ] **Step 1 : tests qui échouent** : pour chacun des cas suivants, `genererPlanBlocs` sur le résultat de la migration donne exactement l'ancien `genererPlan` (mêmes lundis, pct, `external_id`, titres, durées) :
  - course à 12 semaines, `semainesHausse` 3 (cycle incomplet en fin : blocs 4, 4, 2) ;
  - course à 10 semaines, `semainesHausse` 3 (cycle complet en fin : blocs 4, 4 avec `coupure: true` sur le dernier) ;
  - date de début enregistrée pour cet objectif (`debut`, `objectifDebut` = id) ;
  - date de début enregistrée pour un **autre** objectif (début par défaut) ;
  - plafond 1,2 fois la semaine type ;
  - sans objectif : un bloc de 4 semaines, aucune comparaison de plan.
  Si le cas « plan plus court que l'affûtage » (course la semaine prochaine) ne peut pas être identique, le documenter par un test qui fixe le nouveau comportement et une `Ruling:` au journal d'exécution.
- [ ] **Step 2 :** `node --test tests/blocs.test.js` -> Expected : FAIL.
- [ ] **Step 3 :** implémenter `migrerAncienFormat`.
- [ ] **Step 4 :** `node --test` -> Expected : tout passe.
- [ ] **Step 5 :** commit `L8 : migration de la semaine type vers les blocs, plan inchangé (F-88)`.

### Task 4 : stockage de la préparation dans Intervals.icu (F-81, F-88, F-47)

**Files :**
- Create : `js/api/preparation.js` (remplace `js/api/semaine-type.js`, supprimé dans cette tâche)
- Modify : `js/api/bibliotheque.js` (`estModeleAffichable` : les séances de « Mes séances » deviennent des modèles proposés)
- Test : `tests/preparation.test.js` (reprend et adapte `tests/semaine-type.test.js`, supprimé)

**Interfaces :**
- Produces :
  - `NOM_DOSSIER = 'Mes séances (appli triathlon)'`, `ANCIEN_NOM = 'Semaine type (appli triathlon)'`, `ENTETE_PREPARATION = "Préparation gérée par l'appli triathlon (ne pas modifier) :"`
  - `preparationVersTexte({ reglages, blocs }) -> string` : `ENTETE_PREPARATION + '\n' + JSON.stringify({ v: 2, reglages, blocs: blocs.map(({ nom, semaines, coupure, emplacements }) => ({ nom, semaines, coupure, p: emplacements.map((e) => [e.seanceId, e.jour, e.heure]) })) })`
  - `texteVersPreparation(texte) -> { reglages, blocs } | { ancien: reglages } | { illisible: true }` : en-tête présent et JSON valide -> nouveau format (champs inconnus ignorés, `v` absent ou supérieur à 2 -> illisible) ; en-tête présent et JSON invalide -> `{ illisible: true }` ; pas d'en-tête -> `{ ancien: texteVersReglages(texte) }` (ancien format, y compris description vide).
  - `convertirSeanceBibliotheque(brut)` = `convertirSeanceType` actuel (garde `jour` et `heure` lus dans les étiquettes, pour la migration).
  - `versSeanceBibliotheque(s, folderId)` : étiquettes `['semaine-type']` seulement (plus de `jour-N` ni `heure-`), `'repos'` en plus pour un repos.
  - `lirePreparation({ forcer = false }) -> { dossierId, seances, reglages, blocs, ancienFormat, illisible }` : dossier trouvé par `NOM_DOSSIER` ou `ANCIEN_NOM` ; cache `preparation` de 5 min, repli hors ligne comme `lireSemaineType` ; `blocs` null si ancien format ou illisible.
  - `modifierPreparation(transformer) -> preparation` : relit avec `forcer: true`, refuse si `illisible` (erreur `{ type: 'ILLISIBLE' }`), appelle `transformer({ reglages, blocs, seances })` qui renvoie `{ reglages, blocs }`, écrit `PUT /athlete/0/folders/{id}` `{ name: NOM_DOSSIER, description: preparationVersTexte(...) }` (crée le dossier s'il n'existe pas, comme `dossierId()` actuel), vide les caches `preparation` et `bibliotheque`.
  - `enregistrerSeanceBibliotheque(s) -> séance`, `lireSeanceBibliotheque(id) -> séance`.
  - `supprimerSeanceBibliotheque(id)` : d'abord `modifierPreparation` qui retire la séance des blocs (`retirerSeanceDesBlocs`), puis `DELETE /athlete/0/workouts/{id}`.
- [ ] **Step 1 : tests qui échouent** (`tests/preparation.test.js`, `globalThis.fetch` simulé comme dans les tests d'API existants, IndexedDB simulé de la même façon) :
  - aller-retour `preparationVersTexte` / `texteVersPreparation` (deux blocs, une heure null, `coupure` absent puis `true`) ;
  - ancien texte « Réglages du plan (gérés par l'appli) : hausse 8 ; ... » -> `{ ancien: {...} }` ;
  - **revue 3** : en-tête + `{"v":2,"blocs":[` -> `{ illisible: true }`, et `modifierPreparation` lève `ILLISIBLE` sans aucun `PUT` ;
  - **revue 4** : `modifierPreparation` fait un `GET` des dossiers puis un `PUT` dont la description contient le bloc ajouté par la transformation **et** le bloc présent dans la réponse simulée du `GET` (changement venu d'un autre appareil) ;
  - `versSeanceBibliotheque` n'écrit plus d'étiquette de jour ni d'heure ;
  - `estModeleAffichable` renvoie vrai pour une séance étiquetée `semaine-type`.
- [ ] **Step 2 :** `node --test tests/preparation.test.js` -> Expected : FAIL.
- [ ] **Step 3 :** implémenter ; supprimer `js/api/semaine-type.js` et `tests/semaine-type.test.js` ; mettre à jour les imports de `ui/objectif.js` et `ui/programmer.js` vers `api/preparation.js` (l'écran peut rester incomplet jusqu'à la tâche 6 : à cette tâche, seuls les tests et les imports doivent passer).
- [ ] **Step 4 :** `node --test` et le contrôle d'imports du dossier de travail (`imports.mjs`) -> Expected : tout passe, « Imports OK ».
- [ ] **Step 5 :** commit `L8 : bibliothèque Mes séances et blocs rangés dans Intervals.icu (F-81, F-88, F-47)`.

### Task 5 : objectifs de course (F-89)

**Files :**
- Create : `js/logique/objectifs-course.js`
- Modify : `js/api/objectif.js`
- Test : `tests/objectifs-course.test.js`, `tests/objectif.test.js`

**Interfaces :**
- Produces (`logique/objectifs-course.js`) :
  - `FORMATS_COURSE = { XS: {...}, S: {...}, M: {...}, '70.3': {...}, IRONMAN: {...} }` avec `{ NATATION, VELO, CAP }` en mètres (valeurs des Global Constraints).
  - `SEGMENTS_TRIATHLON = ['NATATION', 'T1', 'VELO', 'T2', 'CAP']`
  - `lireTempsCourse(texte) -> s | null` : `h:mm:ss`, `mm:ss` ; secondes et minutes < 60.
  - `tempsDepuisAllure(sport, distance_m, texte) -> s | null` : NATATION `m:ss` par 100 m, CAP `m:ss` par km, VELO km/h (virgule acceptée).
  - `lireObjectifsSaisis(champs, sportCourse) -> { objectifs, erreurs }` : `champs` = `{ format, 'NATATION.distance', 'NATATION.temps', 'NATATION.allure', 'T1.temps', ... }` (chaînes) ; temps prioritaire sur l'allure si les deux sont remplis ; champ vide = segment absent ; distance en km (m pour la natation) ; course d'un seul sport : seul ce segment.
  - `tempsTotal(objectifs, sportCourse) -> s | null` : somme si tous les segments du sport (5 en triathlon, 1 sinon) ont un temps.
  - `ENTETE_OBJECTIFS = "Objectifs (gérés par l'appli) :"`, `objectifsVersTexte(o) -> string` (ligne `ENTETE_OBJECTIFS + ' ' + JSON.stringify(o)`), `texteVersObjectifs(description) -> objectifs | null`, `fusionnerDescription(description, objectifs) -> string` (remplace la ligne gérée, garde le reste ; objectifs null -> ligne retirée).
- Produces (`api/objectif.js`) : `convertirObjectif` ajoute `objectifs` et `descriptionBrute` ; `versEvenementObjectif(o)` ajoute `description: fusionnerDescription(o.descriptionBrute ?? '', o.objectifs)` et `time_target: tempsTotal(...)` si non null ; `lireObjectif` demande aussi le champ `description`.
- [ ] **Step 1 : tests qui échouent**, dont :
```js
assert.equal(lireTempsCourse('1:10:00'), 4200); assert.equal(lireTempsCourse('44:30'), 2670); assert.equal(lireTempsCourse('1:75'), null);
assert.equal(tempsDepuisAllure('NATATION', 1500, '2:00'), 1800);
assert.equal(tempsDepuisAllure('CAP', 10000, '4:27'), 2670);
assert.equal(tempsDepuisAllure('VELO', 40000, '34,3'), Math.round(40 / 34.3 * 3600));
// exemple de la conception : M, 30:00, 2:30, 1:10:00, 1:30, 44:30 -> 2:28:30
assert.equal(tempsTotal(objectifsM, 'ENCHAINEMENT'), 8910);
// revue 5
assert.equal(tempsTotal({ format: 'M', segments: { NATATION: { distance_m: 1500, temps_s: 1800 } } }, 'ENCHAINEMENT'), null);
assert.deepEqual(Object.keys(lireObjectifsSaisis({ format: 'M', 'CAP.temps': '4:7' }, 'ENCHAINEMENT').erreurs), ['CAP.temps']);
assert.equal(fusionnerDescription('Départ 8 h\nVague 2', o), `Départ 8 h\nVague 2\n${objectifsVersTexte(o)}`);
assert.equal(fusionnerDescription(fusionnerDescription('Départ 8 h', o), null), 'Départ 8 h');
```
- [ ] **Step 2 :** `node --test` -> Expected : FAIL sur les nouveaux tests.
- [ ] **Step 3 :** implémenter ; adapter les tests existants de `convertirObjectif`/`versEvenementObjectif` (champs ajoutés).
- [ ] **Step 4 :** `node --test` -> Expected : tout passe.
- [ ] **Step 5 :** commit `L8 : objectifs de course par discipline (F-89)`.

### Task 6 : écran des blocs, Mes séances et placement (F-81, F-84, F-88)

**Files :**
- Create : `js/ui/blocs.js`, `js/ui/placement.js`
- Modify : `js/ui/objectif.js`, `js/ui/programmer.js`, `js/app.js`, `css/style.css`

**Interfaces :**
- Consumes : tâches 1 à 4.
- Produces :
  - routes : `#/objectif?bloc=N` (bloc affiché, 0 par défaut, borné) ; `#/placer?bloc=N&jour=J&heure=hh:mm` (choisir une séance de Mes séances ou « Nouvelle séance ») ; `#/emplacement?bloc=N&n=K` (jour, heure, « Modifier la séance », « Retirer de ce bloc ») ; `#/seance-type/nouvelle?bloc=N&jour=J&heure=hh:mm` (la séance créée est ajoutée à la bibliothèque **et** placée) ; `#/seance-type/{id}` (modifier une séance de la bibliothèque). Tous les paramètres sont vérifiés (entiers bornés, `hh:mm`), sinon valeur par défaut ou retour à `#/objectif`. Onglet de la barre : `accueil` pour `placer` et `emplacement`.
  - `ui/blocs.js` : `sectionBlocs(preparation, allures, indexBloc) -> html` et `brancherBlocs(zone, contexte)` ; la grille actuelle (`sectionSemaineType`, `brancherGrille`) y est déplacée et paramétrée par le bloc : une case vide ouvre `#/placer?...`, une séance placée ouvre `#/emplacement?...`.
- Comportements (conception 5.1, 5.2, 5.4, 5.5) :
  - **Écran Objectif** dans l'ordre : Objectif, Mes séances (liste : icône, titre, durée, « dans N blocs », lien vers l'éditeur, bouton « Nouvelle séance »), Blocs (onglets par bloc + « + Bloc » ; nom et nombre de semaines modifiables ; « Dupliquer » ; « Supprimer » avec `confirm` ; grille ; volume de la grille), Progression (hausse, coupure, affûtage, plafond ; plus de semaines par bloc ni de début), Aperçu.
  - **Migration** : si `ancienFormat` et un objectif lu, `migrerAncienFormat` puis `modifierPreparation` une fois, en ligne seulement ; hors ligne, la préparation migrée est seulement affichée.
  - **Illisible** : message « La préparation enregistrée sur Intervals.icu est illisible. Rien n'a été modifié. » et blocs non modifiables.
  - **Aperçu** : `genererPlanBlocs` ; nom du bloc sur chaque semaine et séparation entre blocs ; message « Le bloc {nom} est vide. » (envoi désactivé) si `blocsVides` n'est pas vide ; « Le plan commence le jj/mm. » si le début est après le lundi suivant ; bornes = `bornesPlan(aujourdhui, debutDesBlocs(...))`. La date de début n'est plus enregistrée : l'appli ne sait plus si le plan a déjà été envoyé, donc **chaque envoi demande confirmation** (« Envoyer le plan ? Les séances du plan déjà présentes à partir du jj/mm seront remplacées ; tes autres séances ne sont pas touchées. »), ce qui garde la protection de D-21.
  - **Éditeur** (`programmer.js`, mode séance type) : plus de sélecteur de jour ni de champ heure pour la séance elle-même ; si `bloc`, `jour`, `heure` sont dans l'adresse, l'enregistrement ajoute l'emplacement (`modifierPreparation` + `ajouterEmplacement`) ; note « Utilisée dans N blocs : la modification s'applique partout. » si N > 1 ; « Supprimer de Mes séances » avec `confirm` citant N.
- [ ] **Step 1 :** écrire le script de vérification navigateur `nav_blocs.py` dans le dossier de travail (sur le modèle de `nav_l8.py`, Intervals.icu simulé avec état, dossier à l'ancien format au départ) qui vérifie : migration (un seul `PUT` du dossier, plan de l'aperçu identique avant et après), création d'un 2e bloc par « Dupliquer », remplacement d'une séance du bloc 2 par une nouvelle créée depuis une case vide, aperçu avec deux noms de blocs et volume en hausse au changement de bloc, suppression d'une séance utilisée dans deux blocs (confirmation, retirée des deux grilles), séance supprimée « sur le site » (retirée de la réponse simulée) ignorée, hors ligne (boutons désactivés), aucune erreur console, aucune requête hors domaine, largeur 390 px sans défilement horizontal.
- [ ] **Step 2 :** lancer le script -> Expected : échecs (écran pas encore construit).
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `node --test` (dont `tests/securite.test.js`), contrôle d'imports, puis le script -> Expected : tout passe, aucune erreur console.
- [ ] **Step 5 :** commit `L8 : écran des blocs, bibliothèque Mes séances et placement des séances (F-81, F-84, F-88)`.

### Task 7 : saisie et affichage des objectifs de course (F-89, F-80)

**Files :**
- Modify : `js/ui/objectif.js`, `js/ui/accueil.js`, `css/style.css`

**Interfaces :**
- Consumes : tâche 5.
- Comportements (conception 5.6) :
  - Formulaire de l'objectif : en triathlon, choix du format (XS, S, M, 70.3, Ironman, Personnalisé ; pré-remplit les distances, modifiables en Personnalisé) puis une ligne par segment `NATATION, T1, VELO, T2, CAP` (distance, temps, allure ; T1/T2 : temps seul) ; course d'un seul sport : une ligne. L'allure est recalculée et affichée quand le temps est saisi, et inversement (calcul par les fonctions de la tâche 5, affichage seulement).
  - Erreurs par champ (`lireObjectifsSaisis`), enregistrement avec l'objectif (même bouton).
  - Carte de l'objectif : tableau de la conception (segment, distance, temps, allure) et « Total visé : h:mm:ss » si `tempsTotal` non null.
  - Accueil : « Total visé h:mm:ss » sous le compte à rebours si disponible.
- [ ] **Step 1 :** compléter `nav_blocs.py` : saisie du format M et de l'exemple de la conception, vérifier « Total visé : 2:28:30 » sur l'écran et sur l'accueil, `description` envoyée contenant la ligne gérée et le texte existant conservé, `time_target` = 8910.
- [ ] **Step 2 :** lancer -> Expected : échec.
- [ ] **Step 3 :** implémenter.
- [ ] **Step 4 :** `node --test`, imports, script -> Expected : tout passe.
- [ ] **Step 5 :** commit `L8 : saisie et affichage des objectifs de course (F-89, F-80)`.

### Task 8 : nettoyage, documentation, version

**Files :**
- Modify : `js/logique/plan.js` (supprimer `coefficientsPlan`, `genererPlan`, `debutEffectif` s'ils ne servent plus qu'à la migration ou aux tests : les garder seulement si `migrerAncienFormat` en a besoin), `tests/plan.test.js`, `tests/blocs.test.js` (les comparaisons avec l'ancien `genererPlan` deviennent des valeurs attendues écrites en clair, relevées avant suppression), `tests/heure.test.js`, `sw.js` (fichiers ajoutés et retirés, `VERSION`), `js/version.js`, `CLAUDE.md`.
- CLAUDE.md : section 2.I ajoute **F-88** « Bibliothèque Mes séances et blocs à contenu propre (grille par bloc, volume qui continue de monter de bloc en bloc, migration de la semaine type) » (M, L8) et **F-89** « Objectifs de course par discipline et transitions, temps total visé, affichés sur l'écran Objectif et l'accueil » (S, L8) ; 9.1 E-09 avec les nouvelles routes ; 6.2 L8 « F-80 à F-89 » ; journal **D-22** (conception, approche A, format de la description, migration fidèle avec `coupure` forcée, `time_target` à vérifier en réel) ; 11 : L8 « évolution blocs codée, test réel à faire ».
- [ ] **Step 1 :** relever les valeurs attendues des tests de non-régression, puis supprimer le code mort.
- [ ] **Step 2 :** `node --test`, imports, `nav_blocs.py`, `nav_l8.py` adapté -> Expected : tout passe.
- [ ] **Step 3 :** `VERSION` et `VERSION_APP` incrémentés (v2.0.13), CLAUDE.md à jour.
- [ ] **Step 4 :** commit `L8 : nettoyage, documentation F-88 et F-89, version v2.0.13 (D-22)`.
