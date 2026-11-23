# Lot L8 : objectif, semaine type et surcharge progressive - plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** enregistrer un objectif (course A), une semaine type, puis générer et envoyer dans Intervals.icu un plan à surcharge progressive par blocs, régénérable.

**Architecture :** calcul du plan en fonctions pures (`logique/plan.js`) ; objectif = événement `RACE_A` (`api/objectif.js`) ; semaine type = dossier `FOLDER` de la bibliothèque, une séance de bibliothèque par séance, jour dans les étiquettes, réglages en clair dans la description du dossier (`api/semaine-type.js`) ; envoi et régénération en lot avec une étiquette `external_id` (`api/plan.js`) ; écran `ui/objectif.js` ; l'éditeur de `ui/programmer.js` sert aussi aux séances de la semaine type.

**Tech Stack :** HTML/CSS/JS natifs sans framework, modules ES, `node --test`, API Intervals.icu (clé API, Basic).

**Spec :** `docs/superpowers/specs/2026-11-23-objectif-semaine-type-design.md`

## Global Constraints

- Règles de CLAUDE.md (section 0) : français, traçabilité F-80 à F-87 en commentaire, couches (`ui/` sans calcul ni réseau, `logique/` pur, seul `api/` appelle Intervals.icu, seul `cache/` touche IndexedDB), UTF-8 sans tirets longs ni guillemets courbes dans le code.
- Endpoints vérifiés dans la spécification OpenAPI : `POST /athlete/{id}/events/bulk` (params `upsertOnUid=false`), `PUT /athlete/{id}/events/bulk-delete` (corps `[{id}]`), `GET/POST /athlete/{id}/folders`, `PUT /athlete/{id}/folders/{folderId}`, `POST /athlete/{id}/workouts`, `PUT/DELETE /athlete/{id}/workouts/{workoutId}`, événements `category` `RACE_A`, champ `external_id`, `Workout.tags`, `Workout.folder_id`. Ne jamais utiliser l'option `upsert` (réservée à OAuth).
- Valeurs par défaut (spec 6) : hausse 8 points, 3 semaines de hausse par bloc, coupure 70 %, affûtage `[70, 50]` (en % de la dernière semaine de hausse), plafond = arrondi supérieur à l'heure de 1,5 x volume de la semaine type, début = lundi suivant.
- Arrondis (spec 6.4) : durée continue à la minute, aux 5 min au-delà d'une heure ; répétitions à l'entier le plus proche, au moins 1 ; distance aux 100 m en natation, aux 500 m ailleurs, au moins une unité.
- ENF-07 : boutons d'écriture désactivés hors ligne avec M-04 (`surveillerReseau` de `ui/composants.js`).
- Fin de tâche (CLAUDE.md 0.4) : incrémenter `VERSION` (sw.js) et `VERSION_APP`, `node --test` vert, imports vérifiés, commit en français citant les F-xx.

## Review Focus

1. Course dans moins de semaines que l'affûtage (ex. course dans 1 semaine) : le plan ne doit contenir que des semaines d'affûtage ou de course, sans erreur. Test : Task 1 `plan très court`.
2. Plafond inférieur au volume de la semaine type : toutes les semaines de hausse sont au plafond, les coupures et l'affûtage restent en dessous. Test : Task 1 `plafond sous la base`.
3. Semaine type vide : l'aperçu affiche un message et l'envoi est impossible (pas de division par zéro sur le volume de base). Test : Task 1 `semaine type vide`.
4. Régénération : seules les séances portant le préfixe `external_id` du plan et datées à partir du lundi suivant sont supprimées ; une séance manuelle le même jour reste. Test : Task 4 `selection des seances a supprimer`.
5. Course un mercredi : aucune séance générée le mercredi ni après dans la semaine de course. Test : Task 2 `rien le jour de la course ni apres`.

---

### Task 1 : calcul des semaines du plan (F-82, F-83)

**Files :**
- Create : `js/logique/plan.js`
- Test : `tests/plan.test.js`

**Interfaces :**
- Produces :
  - `REGLAGES_PAR_DEFAUT = { hausse: 8, semainesHausse: 3, coupure: 70, affutage: [70, 50], plafond_h: null, debut: null }`
  - `plafondParDefaut(volumeBase_s: number) -> number` (heures entières, `Math.ceil(1.5 * volumeBase_s / 3600)`, au moins 1)
  - `lundisDuPlan(debut: 'AAAA-MM-JJ', dateCourse: 'AAAA-MM-JJ') -> string[]` (lundis du lundi de `debut` au lundi de la semaine de la course, inclus ; `[]` si la course est avant `debut`)
  - `coefficientsPlan(nbSemaines: number, reglages, volumeBase_s: number) -> [{ numero: 1.., type: 'HAUSSE'|'COUPURE'|'AFFUTAGE'|'COURSE', pct: int }]`
  - `validerReglages(reglages) -> { champ: message }`

Règles de `coefficientsPlan` (spec 5.3) :
- semaines d'affûtage = `min(affutage.length, nbSemaines)` ; la dernière semaine du plan est de type `COURSE` (niveau = dernier niveau d'affûtage), les autres d'affûtage `AFFUTAGE` ; sans affûtage (`affutage: []`), la dernière semaine garde le niveau de la suite des blocs et prend seulement le type `COURSE` ;
- les semaines restantes sont remplies de blocs : `semainesHausse` semaines `HAUSSE` puis une `COUPURE` ; le dernier bloc est coupé là où commence l'affûtage ;
- 1er bloc : 100, 100+H, 100+2H... ; coupure = `round(semaine précédente * coupure / 100)` ; bloc suivant : repart de la dernière semaine de hausse du bloc précédent, puis +H ;
- plafond : `pctMax = plafond_h * 3600 / volumeBase_s * 100` ; une semaine de hausse ne dépasse jamais `round(pctMax)` ; la reprise part de la valeur plafonnée ;
- affûtage : `round(dernière semaine de hausse * niveau / 100)` ; s'il n'y a eu aucune semaine de hausse, la référence est 100 ;
- `volumeBase_s = 0` : le plafond est ignoré.

`validerReglages` : hausse entier 0 à 30 ; semainesHausse entier 1 à 8 ; coupure entier 30 à 100 ; affutage 0 à 4 niveaux entiers de 20 à 100 ; plafond_h null ou nombre de 1 à 40 ; debut date `AAAA-MM-JJ`.

- [ ] **Step 1 : écrire les tests**

```js
test('exemple validé de la spec (12 semaines)', () => {
  const r = { ...REGLAGES_PAR_DEFAUT };
  assert.deepEqual(coefficientsPlan(12, r, 18000).map((s) => [s.type[0], s.pct]), [
    ['H', 100], ['H', 108], ['H', 116], ['C', 81], ['H', 116], ['H', 124], ['H', 132], ['C', 92],
    ['H', 132], ['H', 140], ['A', 98], ['C', 70],
  ]); // dernière = COURSE
});
test('plan très court : course dans 1 ou 2 semaines', () => {
  assert.deepEqual(coefficientsPlan(1, REGLAGES_PAR_DEFAUT, 18000), [{ numero: 1, type: 'COURSE', pct: 50 }]);
  assert.deepEqual(coefficientsPlan(2, REGLAGES_PAR_DEFAUT, 18000).map((s) => s.pct), [70, 50]);
});
test('plafond sous la base : hausses au plafond, coupures et affûtage en dessous', () => {
  // base 5 h, plafond 4 h -> 80 %
  const p = coefficientsPlan(6, { ...REGLAGES_PAR_DEFAUT, plafond_h: 4 }, 18000);
  assert.deepEqual(p.map((s) => s.pct), [80, 80, 80, 56, 56, 40]);
});
test('plafond atteint en cours de plan', () => {
  // base 5 h, plafond 6 h -> 120 %
  const p = coefficientsPlan(8, { ...REGLAGES_PAR_DEFAUT, affutage: [] , plafond_h: 6 }, 18000);
  assert.deepEqual(p.map((s) => s.pct), [100, 108, 116, 81, 116, 120, 120, 84]);
});
test('semaine type vide : pas de plafond, pas d erreur', () => {
  assert.equal(coefficientsPlan(4, { ...REGLAGES_PAR_DEFAUT, plafond_h: 5 }, 0)[0].pct, 100);
});
test('lundis du plan, plafond par défaut, validation', () => {
  assert.deepEqual(lundisDuPlan('2026-11-30', '2026-12-16'), ['2026-11-30', '2026-12-07', '2026-12-14']);
  assert.deepEqual(lundisDuPlan('2026-11-30', '2026-11-20'), []);
  assert.equal(plafondParDefaut(18000), 8);
  assert.deepEqual(validerReglages({ ...REGLAGES_PAR_DEFAUT, debut: '2026-11-30' }), {});
  assert.ok(validerReglages({ ...REGLAGES_PAR_DEFAUT, debut: '2026-11-30', coupure: 10 }).coupure);
});
```

- [ ] **Step 2 : `node --test tests/plan.test.js`** : échec attendu (module absent).
- [ ] **Step 3 : implémenter `js/logique/plan.js`** (signatures ci-dessus ; dates via `logique/dates.js` : `lundiDe`, `ajouterJours`).
- [ ] **Step 4 : `node --test`** : tout passe.
- [ ] **Step 5 : commit** `L8 : calcul des semaines du plan (F-82, F-83)`.

### Task 2 : surcharge des séances et génération des semaines (F-83, F-84)

**Files :**
- Modify : `js/logique/plan.js`
- Test : `tests/plan.test.js`

**Interfaces :**
- Consumes : `coefficientsPlan`, `lundisDuPlan` (Task 1) ; `dureeTotaleBlocs` (`logique/seance.js`).
- Produces :
  - Séance type (objet interne) : `{ id, jour: 1..7 (1 = lundi), sport, titre, duree_s, distance_m, description, blocs }` (même forme que SeancePrevue de 9.2, `jour` au lieu de `date`).
  - `surchargerSeance(seance, pct: int) -> seance` (règle mixte spec 5.4, arrondis des Global Constraints ; `REPOS` inchangé ; `pct = 100` renvoie une copie identique)
  - `volumeSeance_s(seance, allures: { [sport]: m_s }) -> number` (durées des étapes en temps ; étape en distance = distance / allure du sport si connue, sinon 0 ; séance simple : `duree_s`, sinon distance / allure ; repos : 0)
  - `volumeSemaine_s(seances, allures) -> number`
  - `distanceSansAllure(seances, allures) -> boolean` (vrai si une étape en distance n'a pas pu être convertie)
  - `genererPlan({ semaineType, reglages, dateCourse, allures, objectifId }) -> [{ numero, lundi, type, pct, seances: SeancePrevue+external_id[], volume_s }]`
  - `prefixePlan(objectifId) -> 'plan-{objectifId}-'` ; `externalId(objectifId, numero, date, index) -> 'plan-{objectifId}-s{numero}-{date}-{index}'`

`genererPlan` : volume de base = `volumeSemaine_s(semaineType)` ; pour chaque semaine, chaque séance type du jour J donne une séance datée `ajouterJours(lundi, jour - 1)`, titre `"{titre} S{numero}"` (repos : titre inchangé), surchargée au `pct` de la semaine ; les dates `>= dateCourse` sont exclues ; ordre : date puis ordre de la semaine type ; `volume_s` = volume des séances générées.

- [ ] **Step 1 : écrire les tests**

```js
const rep = { id: 'w1', jour: 2, sport: 'CAP', titre: 'Fractionné', blocs: [
  { type: 'ECHAUFFEMENT', cible: 'PACE', etape: { duree_s: 900, zone: 2 } },
  { type: 'REPETITIONS', cible: 'PACE', repetitions: 5, effort: { duree_s: 240, zone: 4 }, recup: { duree_s: 120, zone: 1 } },
  { type: 'CONTINU', cible: 'PACE', etape: { distance_m: 3000, zone: 2 } }] };
test('règle mixte : continu en durée, répétitions en nombre, distance, zones inchangées', () => {
  const s = surchargerSeance(rep, 120);
  assert.equal(s.blocs[0].etape.duree_s, 1080);
  assert.equal(s.blocs[1].repetitions, 6);
  assert.equal(s.blocs[1].effort.duree_s, 240);
  assert.equal(s.blocs[2].etape.distance_m, 3500);
  assert.equal(s.blocs[1].effort.zone, 4);
});
test('arrondis : 5 min au-delà d une heure, au moins 1 répétition, 100 m en natation', () => {
  assert.equal(surchargerSeance({ sport: 'VELO', titre: 'Longue', duree_s: 7200 }, 108).duree_s, 7800);
  assert.equal(surchargerSeance({ ...rep, blocs: [{ ...rep.blocs[1], repetitions: 1 }] }, 50).blocs[0].repetitions, 1);
  assert.equal(surchargerSeance({ sport: 'NATATION', titre: 'Nage', distance_m: 2000 }, 108).distance_m, 2200);
  assert.deepEqual(surchargerSeance({ sport: 'REPOS', titre: 'Repos' }, 150), { sport: 'REPOS', titre: 'Repos' });
});
test('volume : distance convertie avec l allure seuil, sinon signalée', () => {
  assert.equal(volumeSeance_s(rep, { CAP: 4 }), 900 + 5 * 360 + 750);
  assert.equal(distanceSansAllure([rep], {}), true);
});
test('rien le jour de la course ni après', () => {
  const plan = genererPlan({ semaineType: [rep, { ...rep, id: 'w2', jour: 4 }], reglages: { ...REGLAGES_PAR_DEFAUT, debut: '2026-11-30' },
    dateCourse: '2026-12-10', allures: { CAP: 4 }, objectifId: '77' }); // jeudi 10/12
  const derniere = plan.at(-1);
  assert.equal(derniere.type, 'COURSE');
  assert.deepEqual(derniere.seances.map((s) => s.date), ['2026-12-08']);
  assert.equal(derniere.seances[0].titre, 'Fractionné S2');
  assert.equal(derniere.seances[0].external_id, 'plan-77-s2-2026-12-08-0');
});
```

- [ ] **Step 2 : `node --test tests/plan.test.js`** : échec attendu.
- [ ] **Step 3 : implémenter dans `js/logique/plan.js`.**
- [ ] **Step 4 : `node --test`** : tout passe.
- [ ] **Step 5 : commit** `L8 : surcharge mixte et génération du plan (F-83, F-84)`.

### Task 3 : objectif dans Intervals.icu, affiché dans l'agenda et sur l'accueil (F-80)

**Files :**
- Create : `js/api/objectif.js`
- Modify : `js/api/evenements.js` (lecture de `RACE_A`), `js/ui/composants.js` (carte d'objectif), `js/ui/accueil.js` (widget), `js/logique/sports.js` (type `Transition` déjà mappé : rien à changer), `js/logique/seance.js` (`sportVersType` : `ENCHAINEMENT -> 'Transition'`)
- Test : `tests/objectif.test.js`

**Interfaces :**
- Produces :
  - Objet interne Objectif : `{ id: string, nom, date: 'AAAA-MM-JJ', sport }` (sports proposés : `ENCHAINEMENT` libellé « Triathlon », `CAP`, `VELO`, `NATATION`)
  - `convertirObjectif(brut) -> Objectif` ; `versEvenementObjectif(o) -> { category: 'RACE_A', start_date_local: '{date}T00:00:00', name, type }`
  - `lireObjectif() -> Promise<Objectif|null>` (premier `RACE_A` à partir d'aujourd'hui, sur 2 ans, cache `objectif`, 5 min)
  - `enregistrerObjectif(o) -> Promise<Objectif>` (POST si pas d'id, sinon PUT ; vide les caches `objectif`, `tableau`, `agenda:`)
  - `supprimerObjectif(id) -> Promise<void>`
  - Dans `logique/dates.js` : `joursEntre(a, b) -> int` (compte à rebours J-xx).
- Agenda : `chargerSeancesPrevues` demande aussi `RACE_A` ; une course devient une SeancePrevue avec `objectif: true`, `duree_s: null` ; `carteSeancePrevue` l'affiche avec 🏁 et un lien vers `#/objectif` ; elle ne compte dans aucun volume (`volumeSemaine` de `totaux.js` l'ignore).
- Accueil : widget « Objectif » en tête des cartes : « {nom} · J-{n} » lien `#/objectif`, ou « Définir un objectif » si aucun.

- [ ] **Step 1 : tests** : `convertirObjectif` / `versEvenementObjectif` aller-retour (sport `ENCHAINEMENT` <-> type `Transition`) ; `joursEntre('2026-11-23', '2027-06-14') === 203` ; `estAffichable({ category: 'RACE_A' }) === true` ; `volumeSemaine` ignore une séance `objectif: true`.
- [ ] **Step 2 : échec attendu.**
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : `node --test`** vert.
- [ ] **Step 5 : commit** `L8 : objectif course A (F-80)`.

### Task 4 : semaine type dans la bibliothèque et envoi du plan (F-81, F-85, F-86, F-87)

**Files :**
- Create : `js/api/semaine-type.js`, `js/api/plan.js`
- Modify : `js/api/bibliotheque.js` (exclure les séances étiquetées `semaine-type` de la liste des modèles)
- Test : `tests/semaine-type.test.js`

**Interfaces :**
- Produces (`api/semaine-type.js`) :
  - `NOM_DOSSIER = 'Semaine type (appli triathlon)'` ; étiquettes d'une séance : `['semaine-type', 'jour-{1..7}']`, plus `'repos'` pour un repos (type `Other`).
  - `reglagesVersTexte(reglages) -> string` et `texteVersReglages(texte) -> reglages` (texte lisible, une ligne : `Réglages du plan (gérés par l'appli) : hausse 8 ; semaines 3 ; coupure 70 ; affûtage 70/50 ; plafond 8 h ; début 2026-11-30` ; plafond absent = `aucun` ; texte illisible -> `REGLAGES_PAR_DEFAUT`)
  - `versSeanceBibliotheque(seanceType, folderId) -> WorkoutEx` (`description` = `blocsVersTexte` si blocs, sinon description ; `moving_time`, `distance` pour une séance simple) ; `convertirSeanceType(workout) -> SeanceType` (jour lu dans les étiquettes, blocs via `texteVersBlocs`)
  - `lireSemaineType() -> Promise<{ dossierId: number|null, seances: SeanceType[], reglages }>` (`GET /folders`, dossier `FOLDER` de nom `NOM_DOSSIER` ; cache `semaine-type`, sans expiration, vidé à chaque écriture)
  - `enregistrerSeanceType(seance) -> Promise<SeanceType>` (crée le dossier s'il manque : `POST /folders` `{ type: 'FOLDER', name: NOM_DOSSIER, description: reglagesVersTexte(REGLAGES_PAR_DEFAUT) }`) ; `supprimerSeanceType(id)` ; `lireSeanceType(id)` ; `enregistrerReglages(reglages)` (`PUT /folders/{id}`, description)
- Produces (`api/plan.js`) :
  - `seancesASupprimer(evenements, prefixe, apartirDe) -> id[]` (pure : `external_id` commence par le préfixe et `date >= apartirDe`)
  - `envoyerPlan(plan, objectifId, apartirDe, surProgression(fait, total)) -> Promise<number>` : 1) lit les événements de `apartirDe` à la date de course (`fields: id,start_date_local,external_id`), 2) `bulk-delete` des ids de `seancesASupprimer`, 3) `POST events/bulk?upsertOnUid=false` par lots de 50 (corps = `versEvenement(seance)` + `external_id`), séances de date `>= apartirDe` seulement ; vide `tableau`, `agenda:` ; renvoie le nombre créé.
  - `supprimerPlan(objectifId, apartirDe) -> Promise<number>`.

- [ ] **Step 1 : tests** : aller-retour `reglagesVersTexte`/`texteVersReglages` (dont plafond `aucun`, texte illisible) ; `versSeanceBibliotheque`/`convertirSeanceType` aller-retour structurée, simple et repos ; `seancesASupprimer` garde une séance manuelle le même jour (`external_id` absent) et une séance du plan antérieure à `apartirDe` ; `convertirModele` exclut les séances étiquetées `semaine-type` (via `listerModeles` filtré : tester la fonction de filtre exportée `estModeleAffichable`).
- [ ] **Step 2 : échec attendu.**
- [ ] **Step 3 : implémenter.**
- [ ] **Step 4 : `node --test`** vert.
- [ ] **Step 5 : commit** `L8 : semaine type dans la bibliothèque, envoi et régénération du plan (F-81, F-85, F-86, F-87)`.

### Task 5 : écran Objectif, éditeur de semaine type, aperçu et envoi (F-80 à F-87)

**Files :**
- Create : `js/ui/objectif.js`
- Modify : `js/ui/programmer.js` (mode séance type), `js/app.js` (routes `objectif`, `seance-type`), `js/ui/profil.js` (lien « Objectif et plan »), `css/style.css`, `sw.js`, `js/version.js`, `CLAUDE.md`
- Test : recette navigateur (Playwright, réponses simulées)

**Interfaces :**
- Consumes : tout ce qui précède.
- Routes : `#/objectif` (écran unique en sections) ; `#/seance-type/nouvelle?jour=N` et `#/seance-type/{id}` (éditeur L4).
- `ui/programmer.js`, mode séance type (quand `segments[0] === 'seance-type'`) : le champ date est remplacé par un choix du jour (lundi à dimanche) ; pas de Déplacer ni Dupliquer ; l'erreur `date` de `validerSeance` est ignorée ; enregistrer = `enregistrerSeanceType`, supprimer = `supprimerSeanceType` (confirmation « Retirer cette séance de ta semaine type ? ») ; retour vers `#/objectif`.
- `ui/objectif.js`, sections dans l'ordre :
  1. **Objectif** : nom, date, sport ; Enregistrer ; Supprimer (confirmation, propose aussi `supprimerPlan`).
  2. **Semaine type** : 7 lignes du lundi au dimanche, séances (pastille, titre, durée) cliquables vers `#/seance-type/{id}`, bouton « + » par jour vers `#/seance-type/nouvelle?jour=N` ; volume total de la semaine.
  3. **Réglages** : hausse, semaines par bloc, coupure, niveaux d'affûtage (ex. « 70, 50 »), plafond (h), date de début ; Enregistrer (`enregistrerReglages`).
  4. **Aperçu** : une ligne par semaine (S{n}, dates, %, volume, type) avec barre ; toucher une ligne déplie ses séances ; message si semaine type vide, si pas d'objectif, si une distance n'a pas d'allure seuil ; avertissement « Les séances du plan à partir du {lundi} seront remplacées, y compris si tu les as modifiées sur Intervals.icu. »
  5. **Envoyer** : « Envoyer {n} séances dans Intervals.icu » avec progression, puis message de succès ; « Supprimer le plan à venir ».
  - `apartirDe` = lundi suivant aujourd'hui, ou la date de début si elle est plus tard.
  - Allures seuil : lues dans le profil en cache (`lireProfilEnCache` de `api/profil.js` ; `CAP`, `NATATION`, `VELO` -> `allure_seuil_ms`).

- [ ] **Step 1 : implémenter l'écran, le mode séance type, les routes, les styles.**
- [ ] **Step 2 : `node --test` et vérification des imports** (script `imports.mjs` du scratchpad).
- [ ] **Step 3 : recette Playwright simulée** : créer un objectif, deux séances types, régler, vérifier l'aperçu (exemple de la spec), envoyer (corps `events/bulk` avec `external_id`, lots de 50), régénérer (bulk-delete limité au préfixe), hors ligne (bouton désactivé, M-04), aucune erreur console, aucune requête hors domaine, largeur 390 px.
- [ ] **Step 4 : CLAUDE.md** : lot L8 en section 6, fonctions F-80 à F-87 en section 2 (nouvelle partie I), écran E-09 en 9.1, journal D-18 (choix de la spec section 6 et du plan), état d'avancement ; `VERSION` v2.0.9.
- [ ] **Step 5 : commit** `L8 : écran objectif, semaine type, aperçu et envoi du plan (F-80 à F-87, ENF-07)`.
