# Plan de développement du lot V1.1 « Boucle quotidienne »

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour exécuter ce plan tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** livrer une PWA locale (hors ligne) qui permet de saisir des séances prévues, de les cocher (Faite / Partielle / Sautée + RPE) et de sauvegarder/restaurer les données en JSON.

**Architecture :** HTML/CSS/JS sans framework ni compilation, modules JS natifs. Trois couches : `js/regles/` (fonctions pures testées par `node --test`), `js/db/` (seul accès à IndexedDB), `js/ui/` (écrans, aucun calcul métier). Routeur par ancre dans `js/app.js`, service worker « cache d'abord ».

**Technologies :** JS ES2022 (modules natifs), IndexedDB, Service Worker, `node --test` (Node 24), Python 3 (serveur local + génération des icônes, bibliothèque standard uniquement).

**Spécification :** `CLAUDE.md` (sections 2, 3, 4, 5.4, 9). Toute référence F-xx, C-xx, M-xx, ENF-xx renvoie à ce fichier.

## Contraintes globales

- Langue : interface, commentaires et messages de commit en **français**.
- Aucun framework, aucune bibliothèque, aucune URL externe (ENF-21, ENF-22, ENF-26).
- Fichiers en UTF-8 ; pas de tirets longs ni de guillemets courbes dans le code et le HTML.
- `ui/` ne calcule rien ; `regles/` = fonctions pures sans DOM ni IndexedDB ; seul `db/` touche IndexedDB.
- `js/ui/commun.js` ne touche pas au DOM au chargement du module (il doit rester importable par `node --test`).
- CSP stricte : aucun attribut `style="..."` ni script inline dans le HTML généré ; les couleurs passent par des classes CSS (`.sport-CAP`, etc.). Modifier `element.style` en JS est permis.
- Chaque enregistrement (sauf Meta) porte `id` (UUID via `crypto.randomUUID()`), `athlete_id`, `created_at`, `updated_at` (ISO 8601 UTC) (ENF-27, 4.1).
- Unités stockées : durée en s, distance en m, puissance en W, FC en bpm. Jours au format `AAAA-MM-JJ` en **heure locale** ; affichage jj/mm/aaaa.
- Bornes ENF-20 : RPE 1-10 · FC 30-230 bpm · puissance 0-2000 W · durée 60-43200 s (1 min-12 h) · distance > 0 et ≤ 300 000 m · répétitions 1-50.
- Messages M-01 à M-10 recopiés **à l'identique** depuis 9.4.4.
- Couleurs et icônes des sports : 9.4.3 (ENCHAINEMENT masqué, D-05). Zones et libellés RPE : 9.4.3.
- Zones cliquables ≥ 44 × 44 px ; actions principales en bas (ENF-11).
- Pas de bouton « Enregistrer » : enregistrement automatique (ENF-16).
- À partir de la tâche 6, **chaque tâche** incrémente `VERSION` (`sw.js`) et `VERSION_APP` (`js/ui/commun.js`), format `v1.1.N` (N = 1 à la tâche 6, puis +1 par tâche). Les deux valeurs sont toujours identiques (test `tests/version.test.js`).
- Fin de chaque tâche : `node --test` vert, aucune erreur d'import (console F12 vide pour les tâches avec écran), puis commit avec message en français citant les identifiants et terminé par la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Hors périmètre V1.1 (ne pas coder) : profil, zones chiffrées, vue semaine, modèles, report (`suite`), bilan, paramètres (thème), import .fit/.gpx, mode sombre.

## Points de vigilance (non couverts par la spec, testés quand même)

1. **Saisie de durée ambiguë** : « 1.5 », « 1:75 », « 0:00 », «   », « 1,30 ». Attendu : « 1,30 » = « 1.30 » = 1 h 30 ; les minutes après `:`, `h`, `.` ou `,` doivent faire exactement 2 chiffres et être < 60, sinon `null` ; « 1h » = 3600 s ; 0 s est refusé par la borne (M-02). → tâche 2.
2. **Virgule décimale française** dans les distances (« 10,5 » = 10 500 m) ; natation saisie en m (« 1500 » = 1500 m). → tâche 2.
3. **Jour local et non UTC** : à 23 h 30 en heure de Paris, `toISOString()` donne déjà le lendemain. `jourISO()` doit utiliser l'heure locale ; `decalerJour('2026-10-25', 1)` (changement d'heure) doit donner `'2026-10-26'`. → tâche 5.
4. **Fichier importé quelconque** : JSON valide mais pas une sauvegarde, `null`, tableau, `schema_version` plus récent que le code, tableau manquant. Attendu : rejet M-08 sans rien écrire. → tâche 4.
5. **Texte saisi contenant du HTML** (titre « <b>Seuil</b> », commentaire avec `<img onerror>`) affiché via `innerHTML`. Attendu : affiché tel quel, jamais interprété. `echapperHtml()` est testé et utilisé pour **tout** texte utilisateur. → tâche 5.

Contrôle manuel associé (non testable sous Node) : un double toucher rapide sur une note RPE ne doit créer **qu'une** réalisation (règle 4.5.1) → tâche 10.

---

## Arborescence et responsabilités

| Fichier | Rôle | Tâche |
|---|---|---|
| `package.json` | `{"name":"triathlon-app","private":true,"type":"module","scripts":{"test":"node --test"}}` | 1 |
| `js/regles/validation.js` | Bornes, conversions durée/distance, allure, validation des objets, contrôle du format de sauvegarde (pur) | 1 à 4 |
| `js/ui/commun.js` | Constantes (sports, types, zones, RPE, motifs, douleurs, messages), `VERSION_APP`, outils d'affichage purs (dates, échappement, textes) | 5 |
| `index.html`, `manifest.json`, `sw.js`, `css/style.css`, `creer_icones.py`, `icons/` | Coquille PWA (ENF-01, ENF-05) | 6 |
| `js/app.js` | Démarrage, routeur, barre d'onglets, bandeau de mise à jour | 6, 7 |
| `js/db/database.js` | Ouverture IndexedDB, CRUD (F-35) | 7 |
| `js/db/migrations.js` | `schema_version`, premier lancement C-01, `persist()` (ENF-19, ENF-28) | 7 |
| `js/ui/aujourdhui.js` | E-01 (F-20, F-21, F-23 rapide) | 8, 10 |
| `js/ui/seance.js` | E-02 (F-10, F-11, F-13) | 9 |
| `js/ui/realisation.js` | E-03 (F-21 à F-24) | 11 |
| `js/db/sauvegarde.js` | Export / import / tout supprimer (F-36, ENF-18, ENF-23) | 12 |
| `js/ui/sauvegarde.js` | E-04 + bandeau de rappel (C-15 à C-18) | 12 |
| `tests/*.test.js` | Tests `node --test` (motif de découverte par défaut `**/*.test.js`) | 1 à 6 |

Remarque : l'allure et le contrôle du format de sauvegarde sont placés dans `regles/validation.js` (« contrôles et conversions », 5.4) pour rester purs et testables sans créer de fichier hors arborescence.

---

### Tâche 1 : socle de tests et bornes ENF-20

**Fichiers :**
- Créer : `package.json`, `js/regles/validation.js`
- Test : `tests/validation.test.js`

**Interfaces :**
- Produit :
  - `BORNES` : `{ rpe, fc, puissance, duree, distance, repetitions }`, chaque entrée `{ min, max, minExclusif?, libelle, minAff, maxAff }`. Valeurs : rpe 1-10 (« RPE ») ; fc 30-230 (« FC moyenne », « 30 bpm », « 230 bpm ») ; puissance 0-2000 (« Puissance », « 0 W », « 2000 W ») ; duree 60-43200 (« Durée », « 0:01 », « 12:00 ») ; distance 0 exclusif-300000 (« Distance », « 0 km », « 300 km ») ; repetitions 1-50 (« Répétitions »).
  - `verifierBorne(cle: string, valeur: number|null|undefined) -> null | { code: 'M-02', champ, min, max }` (champ = `libelle`, min/max = `minAff`/`maxAff`). `null`/`undefined` → `null` (l'obligation est gérée ailleurs). Valeur non entière pour rpe, fc, repetitions → erreur M-02.

- [ ] **Étape 1 : écrire `package.json` et le test qui échoue**

```js
// tests/validation.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifierBorne } from '../js/regles/validation.js';

test('bornes ENF-20 : valeurs limites acceptées', () => {
  for (const [cle, v] of [['rpe',1],['rpe',10],['fc',30],['fc',230],['puissance',0],['puissance',2000],
    ['duree',60],['duree',43200],['distance',1],['distance',300000],['repetitions',1],['repetitions',50]]) {
    assert.equal(verifierBorne(cle, v), null, `${cle}=${v}`);
  }
});
test('bornes ENF-20 : valeurs juste hors bornes refusées (M-02)', () => {
  for (const [cle, v] of [['rpe',0],['rpe',11],['fc',29],['fc',231],['puissance',-1],['puissance',2001],
    ['duree',59],['duree',43201],['distance',0],['distance',-5],['distance',300001],['repetitions',0],['repetitions',51]]) {
    assert.equal(verifierBorne(cle, v)?.code, 'M-02', `${cle}=${v}`);
  }
});
test('M-02 porte le libellé et les bornes affichables', () => {
  assert.deepEqual(verifierBorne('rpe', 11), { code: 'M-02', champ: 'RPE', min: '1', max: '10' });
});
test('valeur absente : pas d\'erreur de borne ; RPE décimal refusé', () => {
  assert.equal(verifierBorne('rpe', null), null);
  assert.equal(verifierBorne('rpe', 5.5)?.code, 'M-02');
});
```

- [ ] **Étape 2 : lancer `node --test`** → ÉCHEC (module introuvable).
- [ ] **Étape 3 : implémenter `BORNES` et `verifierBorne` dans `js/regles/validation.js`** (commentaire d'en-tête : ENF-20, ENF-29).
- [ ] **Étape 4 : lancer `node --test`** → 4 tests OK.
- [ ] **Étape 5 : commit** `git add package.json js/regles/validation.js tests/validation.test.js` puis `git commit` avec le message « V1.1 : bornes de saisie et socle de tests (ENF-20, ENF-29) ».

---

### Tâche 2 : conversions de durée et de distance (D-09)

**Fichiers :**
- Modifier : `js/regles/validation.js`
- Test : `tests/durees.test.js`

**Interfaces :**
- Produit :
  - `lireDuree(texte: string) -> number|null` : secondes. Accepte « 1:30 », « 1h30 », « 1h », « 1.30 », « 1,30 », minutes seules « 90 ». Espaces ignorés. Minutes après séparateur : exactement 2 chiffres et < 60, sinon `null`. Vide → `null`.
  - `formaterDuree(s: number) -> string` : « h:mm » (4500 → « 1:15 », 300 → « 0:05 »). Secondes arrondies à la minute inférieure.
  - `lireDureeCourte(texte) -> number|null` : « m:ss » ou minutes seules (blocs et récup). `formaterDureeCourte(s) -> 'm:ss'` (60 → « 1:00 », 600 → « 10:00 »).
  - `lireDistance(texte: string, sport: string) -> number|null` : mètres. Virgule ou point décimal. NATATION : valeur en m (entier) ; autres sports : valeur en km × 1000, arrondie au mètre. Vide ou non numérique → `null`.
  - `formaterDistanceSaisie(m, sport) -> string` : inverse pour préremplir un champ (« 10,5 » ; natation « 1500 »).

- [ ] **Étape 1 : écrire le test qui échoue**

```js
test('lireDuree : formats D-09', () => {
  assert.equal(lireDuree('1:15'), 4500);
  assert.equal(lireDuree('1:30'), 5400);
  assert.equal(lireDuree('1h30'), 5400);
  assert.equal(lireDuree('1h'), 3600);
  assert.equal(lireDuree('1.30'), 5400);
  assert.equal(lireDuree('1,30'), 5400);
  assert.equal(lireDuree('90'), 5400);
  assert.equal(lireDuree(' 0:45 '), 2700);
});
test('lireDuree : saisies invalides -> null', () => {
  for (const t of ['', '   ', 'abc', '1.5', '1:75', '1:5', '-1:00', '1:30:00']) assert.equal(lireDuree(t), null, t);
});
test('formaterDuree : secondes -> h:mm, aller-retour', () => {
  assert.equal(formaterDuree(4500), '1:15');
  assert.equal(formaterDuree(300), '0:05');
  assert.equal(formaterDuree(43200), '12:00');
  assert.equal(lireDuree(formaterDuree(4500)), 4500);
});
test('durée courte m:ss', () => {
  assert.equal(lireDureeCourte('1:00'), 60);
  assert.equal(lireDureeCourte('10'), 600);
  assert.equal(formaterDureeCourte(90), '1:30');
});
test('lireDistance : km avec virgule, natation en m', () => {
  assert.equal(lireDistance('10,5', 'CAP'), 10500);
  assert.equal(lireDistance('42.195', 'CAP'), 42195);
  assert.equal(lireDistance('1500', 'NATATION'), 1500);
  assert.equal(lireDistance('', 'VELO'), null);
  assert.equal(lireDistance('x', 'VELO'), null);
  assert.equal(formaterDistanceSaisie(10500, 'CAP'), '10,5');
});
```

(Imports en tête : `lireDuree, formaterDuree, lireDureeCourte, formaterDureeCourte, lireDistance, formaterDistanceSaisie`.)

- [ ] **Étape 2 : `node --test`** → ÉCHEC (exports absents).
- [ ] **Étape 3 : implémenter les six fonctions** dans `validation.js` (expression régulière unique pour `lireDuree` : `^(\d{1,2})(?:[:h.,](\d{2})?)?$` après suppression des espaces, avec le cas « nombre seul = minutes » et « 1h » ; refuser `\d+[.,]\d` à un chiffre).
- [ ] **Étape 4 : `node --test`** → tout OK.
- [ ] **Étape 5 : commit** « V1.1 : conversions durée h:mm et distance (D-09, F-11, F-22) ».

---

### Tâche 3 : calcul de l'allure (4.4)

**Fichiers :**
- Modifier : `js/regles/validation.js`
- Test : `tests/allure.test.js`

**Interfaces :**
- Produit : `calculerAllure(sport: string, duree_s: number, distance_m: number) -> string|null`
  - CAP : « m:ss /km » ; NATATION : « m:ss /100 m » ; VELO : « xx,x km/h » (virgule, 1 décimale) ; autres sports, durée ou distance absente ou ≤ 0 → `null`. Secondes arrondies à l'unité.

- [ ] **Étape 1 : test qui échoue**

```js
test('allure CAP en min/km', () => {
  assert.equal(calculerAllure('CAP', 3000, 10000), '5:00 /km');
  assert.equal(calculerAllure('CAP', 2700, 10000), '4:30 /km');
});
test('allure natation en min/100 m', () => {
  assert.equal(calculerAllure('NATATION', 1800, 1500), '2:00 /100 m');
});
test('vitesse vélo en km/h', () => {
  assert.equal(calculerAllure('VELO', 3600, 30000), '30,0 km/h');
  assert.equal(calculerAllure('VELO', 5400, 40000), '26,7 km/h');
});
test('pas d\'allure sans données ou pour renfo/repos', () => {
  assert.equal(calculerAllure('CAP', 3000, null), null);
  assert.equal(calculerAllure('CAP', 0, 10000), null);
  assert.equal(calculerAllure('RENFO', 3000, 1000), null);
});
```

- [ ] **Étape 2 : `node --test`** → ÉCHEC.
- [ ] **Étape 3 : implémenter `calculerAllure`** (réutilise `formaterDureeCourte`).
- [ ] **Étape 4 : `node --test`** → OK.
- [ ] **Étape 5 : commit** « V1.1 : calcul de l'allure par sport (F-22) ».

---

### Tâche 4 : validation des objets et du format de sauvegarde

**Fichiers :**
- Modifier : `js/regles/validation.js`
- Test : `tests/objets.test.js`, `tests/sauvegarde.test.js`

**Interfaces :**
- Produit :
  - `validerSeancePrevue(s) -> { ok: boolean, erreurs: Object<champ, erreur> }` : `titre` vide (après trim) → `{code:'M-01'}` ; titre > 60 car. → `{code:'M-02', champ:'Titre', min:'1', max:'60 caractères'}` ; `duree_s` → `verifierBorne('duree')` ; `distance_m` → `verifierBorne('distance')` ; chaque bloc : `repetitions` → `verifierBorne('repetitions')`. Clé d'erreur des blocs : `blocs.<index>.repetitions`.
  - `validerRealisation(r) -> { ok, erreurs }` : `statut` absent → M-10 ; SAUTEE sans `motif` → M-10 sur `motif` ; FAITE/PARTIELLE : `duree_s` et `rpe` obligatoires (M-10), bornes duree, rpe, distance, fc (`fc_moy`), puissance (`puissance_moy_w`) ; `douleur` présente sans `zone` ou intensité hors 1-5 → M-02 (« Intensité », « 1 », « 5 ») ; `sport` absent → M-10.
  - `normaliserRealisation(r) -> objet` (copie, règle 4.5.2) : SAUTEE → supprime `duree_s, distance_m, fc_moy, puissance_moy_w, rpe, douleur` ; non SAUTEE → supprime `motif` ; sport ≠ VELO → supprime `puissance_moy_w` ; supprime les champs `null`/`''`.
  - `SCHEMA_VERSION = 1` et `STORES = ['meta','athletes','parametres','seances_prevues','realisations']` (exportés ici, réutilisés par `db/`).
  - `verifierSauvegarde(objet, versionCode = SCHEMA_VERSION) -> boolean` : vrai seulement si objet non nul, non tableau, `app === 'triathlon-app'`, `schema_version` entier ≤ `versionCode`, `donnees` contient les 5 `STORES` et chacun est un tableau (9.6).

- [ ] **Étape 1 : tests qui échouent**

```js
// tests/objets.test.js
test('séance prévue : titre obligatoire (M-01) puis valide', () => {
  assert.equal(validerSeancePrevue({ titre: '  ', sport: 'CAP' }).erreurs.titre.code, 'M-01');
  assert.equal(validerSeancePrevue({ titre: 'Footing', sport: 'CAP', duree_s: 3600 }).ok, true);
});
test('séance prévue : bloc à 51 répétitions refusé', () => {
  const r = validerSeancePrevue({ titre: 'VMA', sport: 'CAP', segments: [{ ordre: 1, sport: 'CAP', blocs: [{ repetitions: 51, distance_m: 400 }] }] });
  assert.equal(r.erreurs['blocs.0.repetitions'].code, 'M-02');
});
test('réalisation FAITE : durée et RPE obligatoires', () => {
  const r = validerRealisation({ statut: 'FAITE', sport: 'CAP' });
  assert.equal(r.erreurs.duree_s.code, 'M-10');
  assert.equal(r.erreurs.rpe.code, 'M-10');
});
test('réalisation SAUTEE : motif obligatoire, mesures retirées', () => {
  assert.equal(validerRealisation({ statut: 'SAUTEE', sport: 'CAP' }).erreurs.motif.code, 'M-10');
  const n = normaliserRealisation({ statut: 'SAUTEE', motif: 'METEO', sport: 'CAP', rpe: 5, duree_s: 600, commentaire: 'pluie' });
  assert.deepEqual(n, { statut: 'SAUTEE', motif: 'METEO', sport: 'CAP', commentaire: 'pluie' });
});
test('puissance retirée hors vélo, FC 231 refusée', () => {
  assert.equal(normaliserRealisation({ statut: 'FAITE', sport: 'CAP', puissance_moy_w: 200 }).puissance_moy_w, undefined);
  assert.equal(validerRealisation({ statut: 'FAITE', sport: 'CAP', duree_s: 600, rpe: 5, fc_moy: 231 }).erreurs.fc_moy.code, 'M-02');
});

// tests/sauvegarde.test.js
const valide = () => ({ app: 'triathlon-app', schema_version: 1, date_export: '2026-10-27T08:00:00Z',
  donnees: { meta: [], athletes: [], parametres: [], seances_prevues: [], realisations: [] } });
test('sauvegarde valide acceptée', () => assert.equal(verifierSauvegarde(valide()), true));
test('fichiers incorrects rejetés', () => {
  const cas = [null, 'texte', [], {}, { ...valide(), app: 'autre' }, { ...valide(), schema_version: 2 },
    { ...valide(), schema_version: '1' }, { ...valide(), donnees: null }];
  const sansStore = valide(); delete sansStore.donnees.realisations; cas.push(sansStore);
  const pasTableau = valide(); pasTableau.donnees.meta = {}; cas.push(pasTableau);
  for (const c of cas) assert.equal(verifierSauvegarde(c), false, JSON.stringify(c));
});
```

- [ ] **Étape 2 : `node --test`** → ÉCHEC.
- [ ] **Étape 3 : implémenter les fonctions et constantes** listées.
- [ ] **Étape 4 : `node --test`** → OK.
- [ ] **Étape 5 : commit** « V1.1 : validation des séances, réalisations et sauvegardes (ENF-20, F-36, C-14) ».

---

### Tâche 5 : constantes et outils d'affichage (`ui/commun.js`)

**Fichiers :**
- Créer : `js/ui/commun.js`
- Test : `tests/commun.test.js`

**Interfaces :**
- Consomme : `formaterDuree`, `formaterDureeCourte` (tâche 2).
- Produit :
  - `SPORTS` : tableau ordonné `[{ code, libelle, couleur, icone }]` pour NATATION, VELO, CAP (« Course »), RENFO, REPOS (valeurs 9.4.3 ; ENCHAINEMENT absent, D-05). `sport(code)` → l'entrée.
  - `TYPES` : `[{code, libelle}]` ENDURANCE « Endurance », SEUIL « Seuil », FRACTIONNE « Fractionné », TECHNIQUE « Technique », TEST « Test », RECUP « Récup ».
  - `ZONES` : `{1:{rpe:'1-2', libelle:'Très facile, récupération'}, ... 5:{rpe:'9-10', libelle:'Maximal'}}`.
  - `LIBELLES_RPE` : `{1:'Très facile',2:'Très facile',3:'Facile',4:'Facile',5:'Modéré',6:'Modéré',7:'Difficile',8:'Difficile',9:'Très difficile',10:'Maximal'}`.
  - `MOTIFS` : FATIGUE « Fatigue », BLESSURE « Blessure », TEMPS « Manque de temps », METEO « Météo », AUTRE « Autre ».
  - `ZONES_DOULEUR` : Pied, Cheville, Mollet, Genou, Cuisse, Hanche, Dos, Épaule, Autre.
  - `MESSAGES` : M-01 à M-10, texte exact de 9.4.4 avec gabarits `{champ}`, `{min}`, `{max}`, `{delai}`.
  - `formaterMessage(erreur | code, params?) -> string` : remplace les gabarits.
  - `jourISO(date = new Date()) -> 'AAAA-MM-JJ'` en heure locale ; `decalerJour(iso, n) -> iso` ; `formaterDateLongue(iso) -> 'Mardi 27/10/2026'` ; `formaterDateCourte(iso) -> '27/10/2026'`.
  - `echapperHtml(texte) -> string` (`& < > " '`).
  - `formaterDistance(m, sport) -> '10,5 km' | '1500 m'`.
  - `texteBloc(bloc) -> string` : `{repetitions:5, distance_m:400, zone:4, recup_s:60}` → « 5 × 400 m Z4, récup 1:00 » ; `{repetitions:3, duree_s:600, zone:3}` → « 3 × 10:00 Z3 » ; répétitions = 1 → pas de préfixe « 1 × ».
  - `lireRoute(hash) -> { segments: string[], params: Object }`.

- [ ] **Étape 1 : test qui échoue**

```js
test('jourISO utilise l\'heure locale (point de vigilance 3)', () => {
  assert.equal(jourISO(new Date(2026, 9, 27, 23, 30)), '2026-10-27');
});
test('decalerJour traverse le changement d\'heure et les fins de mois', () => {
  assert.equal(decalerJour('2026-10-25', 1), '2026-10-26');
  assert.equal(decalerJour('2026-11-01', -1), '2026-10-31');
});
test('formaterDateLongue', () => assert.equal(formaterDateLongue('2026-10-27'), 'Mardi 27/10/2026'));
test('echapperHtml neutralise le HTML (point de vigilance 5)', () => {
  assert.equal(echapperHtml('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
});
test('messages exacts', () => {
  assert.equal(formaterMessage({ code: 'M-02', champ: 'RPE', min: '1', max: '10' }),
    'Valeur impossible : RPE doit être entre 1 et 10.');
  assert.equal(formaterMessage('M-01'), 'Le titre est obligatoire.');
});
test('texte des blocs', () => {
  assert.equal(texteBloc({ repetitions: 5, distance_m: 400, zone: 4, recup_s: 60 }), '5 × 400 m Z4, récup 1:00');
  assert.equal(texteBloc({ repetitions: 1, duree_s: 1200, zone: 2 }), '20:00 Z2');
});
test('lireRoute', () => {
  assert.deepEqual(lireRoute('#/aujourdhui?date=2026-10-27'), { segments: ['aujourdhui'], params: { date: '2026-10-27' } });
  assert.deepEqual(lireRoute('#/seance/abc'), { segments: ['seance', 'abc'], params: {} });
  assert.deepEqual(lireRoute(''), { segments: [], params: {} });
});
test('formaterDistance', () => {
  assert.equal(formaterDistance(10500, 'CAP'), '10,5 km');
  assert.equal(formaterDistance(1500, 'NATATION'), '1500 m');
});
```

- [ ] **Étape 2 : `node --test`** → ÉCHEC.
- [ ] **Étape 3 : implémenter `js/ui/commun.js`** (aucun accès au DOM au chargement ; `decalerJour` construit la date avec `new Date(a, m-1, j + n)`).
- [ ] **Étape 4 : `node --test`** → OK.
- [ ] **Étape 5 : commit** « V1.1 : constantes et outils d'affichage (9.4.3, 9.4.4, ENF-15) ».

---

### Tâche 6 : coquille PWA (installable, hors ligne, routeur vide)

**Fichiers :**
- Créer : `index.html`, `manifest.json`, `sw.js`, `css/style.css`, `creer_icones.py`, `icons/icon-192.png`, `icons/icon-512.png`, `js/app.js`
- Modifier : `js/ui/commun.js` (ajout `export const VERSION_APP = 'v1.1.1'`)
- Test : `tests/version.test.js`

**Interfaces :**
- Consomme : `lireRoute`, `VERSION_APP` (tâche 5).
- Produit :
  - `index.html` : `<meta charset="utf-8">`, viewport, `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">`, lien manifest, `<div id="bandeau"></div>`, `<main id="app"></main>`, `<nav id="onglets">` (liens « Aujourd'hui » `#/aujourdhui`, « Sauvegarde » `#/sauvegarde`), `<script type="module" src="js/app.js">`.
  - `manifest.json` : `name` « Triathlon », `short_name` « Triathlon », `start_url` « ./ », `scope` « ./ », `display` « standalone », `lang` « fr », icônes 192 et 512 (`purpose: "any"`), `theme_color` `#2E7D32`, `background_color` `#FFFFFF`.
  - `sw.js` : `const VERSION = 'v1.1.1'` ; `FICHIERS` = liste explicite de tous les fichiers de l'app (chemins relatifs « ./… ») ; `install` met en cache `triathlon-${VERSION}` ; `activate` supprime les autres caches ; `fetch` cache d'abord puis réseau ; message `'ACTIVER'` → `self.skipWaiting()`. Pas de `skipWaiting` automatique.
  - `js/app.js` : enregistre le service worker ; affiche le bandeau « Nouvelle version disponible » (bouton « Recharger » → `postMessage('ACTIVER')`, puis rechargement sur `controllerchange`) ; `ROUTES` = table `segment -> async (conteneur, segments, params) => void` (pour l'instant des écrans vides titrés) ; route vide → `#/aujourdhui` ; onglet actif surligné.
  - `css/style.css` : variables CSS (couleurs, espacements), classes `.sport-NATATION` … `.sport-REPOS` (couleur de bordure/fond pâle), barre d'onglets fixe en bas, boutons ≥ 44 px, largeur max 640 px centrée, aucun défilement horizontal de 360 à 1920 px (ENF-02, ENF-11, ENF-12).
  - `creer_icones.py` : bibliothèque standard uniquement (`zlib`, `struct`) ; écrit deux PNG carrés (fond `#2E7D32`, cercle ou bande blanche simple) dans `icons/`.

- [ ] **Étape 1 : test qui échoue**

```js
// tests/version.test.js
import { readFileSync } from 'node:fs';
import { VERSION_APP } from '../js/ui/commun.js';
test('VERSION (sw.js) = VERSION_APP', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.equal(sw.match(/const VERSION = '([^']+)'/)[1], VERSION_APP);
});
test('tous les fichiers listés dans sw.js existent', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const liste = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
  for (const f of liste) assert.doesNotThrow(() => readFileSync(new URL('../' + f, import.meta.url)), f);
});
```

- [ ] **Étape 2 : `node --test`** → ÉCHEC.
- [ ] **Étape 3 : créer les fichiers** listés ci-dessus, puis lancer `python creer_icones.py` (vérifier que les deux PNG existent).
- [ ] **Étape 4 : `node --test`** → OK. (À chaque tâche suivante qui crée un fichier JS, l'ajouter à `FICHIERS` dans `sw.js` ; ce test le vérifie.)
- [ ] **Étape 5 : vérifier dans le navigateur** : `python -m http.server 8000`, ouvrir http://localhost:8000 → redirection vers `#/aujourdhui`, onglets fonctionnels, console F12 sans erreur ni violation CSP, Application → Manifest sans erreur, service worker activé. Arrêter le serveur.
- [ ] **Étape 6 : commit** « V1.1 : coquille PWA, service worker et routeur (ENF-01, ENF-02, ENF-05, ENF-21, ENF-22) ».

---

### Tâche 7 : base IndexedDB et premier lancement (F-35, C-01)

**Fichiers :**
- Créer : `js/db/database.js`, `js/db/migrations.js`
- Modifier : `js/app.js` (attendre `initialiser()` avant le premier rendu), `sw.js` (FICHIERS + VERSION), `js/ui/commun.js` (VERSION_APP)

**Interfaces :**
- Consomme : `SCHEMA_VERSION`, `STORES` (tâche 4).
- Produit (`database.js`) :
  - `ouvrirBase() -> Promise<IDBDatabase>` : base `triathlon-app`, version IndexedDB 1 ; stores à `keyPath: 'id'` ; index `athlete_date` sur `['athlete_id','date']` dans `seances_prevues` et `realisations` ; index `seance_prevue_id` dans `realisations`. Connexion mémorisée.
  - `lire(store, id) -> Promise<objet|undefined>`
  - `ecrire(store, objet) -> Promise<objet>` : ajoute `id` (UUID) s'il manque, `created_at` s'il manque, `updated_at` à chaque écriture (pas pour `meta`) ; renvoie l'objet écrit.
  - `supprimer(store, id) -> Promise<void>`
  - `listerTout(store) -> Promise<objet[]>`
  - `listerParJour(store, athleteId, date) -> Promise<objet[]>` (via `athlete_date`) ; pour `seances_prevues`, trié par `ordre`.
  - `realisationDeSeance(seanceId) -> Promise<objet|undefined>` (via `seance_prevue_id`).
  - `prochainOrdre(athleteId, date) -> Promise<number>` (C-03 : dernier + 1, 1 si aucun).
  - `supprimerSeancePrevue(id) -> Promise<void>` : une seule transaction ; supprime la séance et retire `seance_prevue_id` de sa réalisation (C-13, règle 4.5.5).
  - `creerRealisationUnique(r) -> Promise<objet>` : dans une transaction, si une réalisation existe déjà pour `r.seance_prevue_id`, la renvoie sans rien créer (règle 4.5.1).
  - `viderTout() -> Promise<void>` ; `remplacerTout(donnees) -> Promise<void>` (une transaction sur les 5 stores : vider puis écrire tels quels, sans toucher aux horodatages).
- Produit (`migrations.js`) :
  - `initialiser() -> Promise<{ athleteId: string }>` : lit `meta` ; absent → C-01 : crée `{id:'meta', schema_version: SCHEMA_VERSION}`, l'athlète par défaut (`nom` « Athlète », `niveau` DEBUTANT, `disponibilites` [], `volume_max_semaine_s` 0, `materiel` tout à faux, `questionnaire_termine` faux) et les paramètres (`theme` AUTO, `rappel_sauvegarde_jours` 7) ; `schema_version` < code → copie de sécurité (JSON de tous les stores dans `localStorage['triathlon-copie-avant-migration']`) puis application de `MIGRATIONS` (objet vide en V1.1) et mise à jour de `schema_version` ; puis `navigator.storage?.persist?.()` avec `console.log('Stockage persistant :', resultat)` (ENF-19). Renvoie l'id du premier athlète.

- [ ] **Étape 1 : implémenter `database.js` puis `migrations.js`** (commentaires F-35, C-01, ENF-19, ENF-27, ENF-28). Promesses autour des requêtes IndexedDB via un petit utilitaire interne `enPromesse(requete)`.
- [ ] **Étape 2 : brancher `initialiser()` dans `app.js`** ; stocker `athleteId` dans un objet de contexte passé aux écrans.
- [ ] **Étape 3 : `node --test`** → OK (les tests n'importent pas `db/`).
- [ ] **Étape 4 : vérifier dans le navigateur** (serveur local) : F12 → Application → IndexedDB → `triathlon-app` contient les 5 stores, `meta` (`schema_version` 1), 1 athlète, 1 paramètres ; console : « Stockage persistant : … » ; recharger → pas de doublon d'athlète.
- [ ] **Étape 5 : commit** « V1.1 : stockage IndexedDB et premier lancement (F-35, C-01, ENF-19, ENF-27, ENF-28) ».

---

### Tâche 8 : écran E-01 « Aujourd'hui », affichage et navigation

**Fichiers :**
- Créer : `js/ui/aujourdhui.js`
- Modifier : `js/app.js` (route `aujourdhui`), `css/style.css`, `sw.js`, `js/ui/commun.js` (VERSION_APP)

**Interfaces :**
- Consomme : `listerParJour`, `realisationDeSeance` (tâche 7) ; `jourISO`, `decalerJour`, `formaterDateLongue`, `sport`, `ZONES`, `texteBloc`, `formaterDuree`, `formaterDistance`, `echapperHtml`, `MOTIFS` (tâche 5).
- Produit : `afficherAujourdhui(conteneur, contexte, params) -> Promise<void>` (date = `params.date` ou `jourISO()`).

Contenu (9.1) :
- En-tête « ◀ Mardi 27/10/2026 ▶ » ; lien « Aujourd'hui » si date ≠ aujourd'hui. ◀/▶ changent `location.hash` vers `#/aujourdhui?date=…` (C-19, rendu < 0,3 s : une seule lecture IndexedDB par écran).
- Cartes des séances prévues par `ordre` : classe `sport-<CODE>`, icône, titre, badge « ★ Clé », durée (`formaterDuree`), distance, « Z4 · RPE 7-8 » (D-02), blocs dans un `<details>` repliable. Toucher la carte hors boutons → `#/seance/{id}`.
- Sans réalisation et sport ≠ REPOS : boutons Faite / Partielle / Sautée (inactifs à ce stade, branchés en tâche 10). Avec réalisation : badge du statut (« Faite · RPE 6 », « Partielle · RPE 4 », « Sautée · Météo ») + lien « Modifier » → `#/realisation/{id}`.
- Séances non prévues du jour (réalisations sans `seance_prevue_id`) affichées en dessous avec badge et lien « Modifier ».
- Aucune séance → « Aucune séance prévue. » (C-02).
- En bas : « + Séance prévue » → `#/seance/nouvelle?date=…` ; « + Séance non prévue » → `#/realisation/nouvelle?date=…`.
- Tout texte utilisateur passe par `echapperHtml`.

- [ ] **Étape 1 : implémenter `afficherAujourdhui`** et la brancher dans `ROUTES`.
- [ ] **Étape 2 : `node --test`** → OK.
- [ ] **Étape 3 : vérifier dans le navigateur** : « Aucune séance prévue. » ; ◀ ▶ changent le jour ; lien « Aujourd'hui » apparaît sur un autre jour ; console vide. L'affichage des cartes sera vérifié à la tâche 9.
- [ ] **Étape 4 : commit** « V1.1 : écran Aujourd'hui, navigation jour par jour (F-20, C-02, C-19, D-04) ».

---

### Tâche 9 : écran E-02 « Séance prévue » (création, modification, suppression)

**Fichiers :**
- Créer : `js/ui/seance.js`
- Modifier : `js/app.js` (route `seance`), `css/style.css`, `sw.js`, `js/ui/commun.js` (VERSION_APP)

**Interfaces :**
- Consomme : `lire`, `ecrire`, `prochainOrdre`, `supprimerSeancePrevue` (tâche 7) ; `validerSeancePrevue`, `lireDuree`, `formaterDuree`, `lireDureeCourte`, `formaterDureeCourte`, `lireDistance`, `formaterDistanceSaisie` (tâches 2, 4) ; `SPORTS`, `TYPES`, `MESSAGES`, `formaterMessage`, `formaterDateCourte` (tâche 5).
- Produit : `afficherSeance(conteneur, contexte, segments, params) -> Promise<void>` (`segments[1]` = `'nouvelle'` ou un id).

Comportement (9.4.1) :
- Champs et défauts : date (`<input type="date">`, défaut `params.date`), sport (boutons, défaut CAP), type (liste, défaut ENDURANCE), titre (60 car. max), durée (texte h:mm), distance (km, m pour la natation : l'unité affichée suit le sport), zone (boutons Aucune, Z1-Z5), clé (case), blocs (répétitions, durée m:ss **ou** distance m, zone, récup m:ss ; « + Ajouter un bloc », bouton de suppression par bloc), description.
- Sport REPOS → type, durée, distance, zone, blocs masqués ; enregistré avec `type` RECUP, `segments` [] et sans durée/distance/zone (C-05, F-13).
- Enregistrement auto (C-04) : 500 ms après la dernière frappe ou au `change`/`blur`. Avant écriture : `validerSeancePrevue` ; en cas d'erreur, champ en rouge (classe `invalide`) + message `formaterMessage` sous le champ, rien n'est écrit (C-14). Titre vide → rien n'est créé (M-01 affiché seulement après sortie du champ titre).
- Première création : `ordre = prochainOrdre(...)`, `cle` faux par défaut, puis `history.replaceState` vers `#/seance/{id}` pour que la suite modifie le même objet. Si la date change ensuite, l'`ordre` est conservé.
- Blocs stockés dans `segments: [{ ordre: 1, sport, blocs: [...] }]` (D-05).
- En modification : bouton « Supprimer » → `confirm(M-03)` → `supprimerSeancePrevue` → retour E-01 à la date de la séance (C-13).
- Bouton « Retour » → E-01 à la date de la séance (enregistrement en attente déclenché avant de quitter).

- [ ] **Étape 1 : implémenter `afficherSeance`**.
- [ ] **Étape 2 : `node --test`** → OK.
- [ ] **Étape 3 : vérifier dans le navigateur** : créer « Fractionné 5 × 400 m » avec 2 blocs + clé → visible sur E-01 avec « ★ Clé » et blocs repliables ; modifier le titre, recharger → conservé ; durée « 1h30 » → affichée « 1:30 » ; durée « 13:00 » → message M-02 en rouge, rien enregistré ; sport Repos masque les champs ; titre vide → aucune séance créée ; supprimer → disparue ; deux séances le même jour → ordre respecté. Console vide.
- [ ] **Étape 4 : commit** « V1.1 : formulaire de séance prévue avec enregistrement auto (F-10, F-11, F-13, C-03, C-04, C-05, C-13, C-14) ».

---

### Tâche 10 : saisie rapide depuis la carte (Faite / Partielle / Sautée)

**Fichiers :**
- Modifier : `js/ui/aujourdhui.js`, `css/style.css`, `sw.js`, `js/ui/commun.js` (VERSION_APP)

**Interfaces :**
- Consomme : `creerRealisationUnique` (tâche 7) ; `validerRealisation`, `normaliserRealisation`, `lireDuree`, `formaterDuree` (tâche 4) ; `LIBELLES_RPE`, `MOTIFS` (tâche 5).
- Produit : feuille modale interne à `aujourdhui.js` (`ouvrirFeuille(contenu)` / `fermerFeuille()`), affichée en bas d'écran.

Comportement :
- **Faite** (C-06, C-07) : feuille de 10 boutons « 1 Très facile » … « 10 Maximal » ; un toucher crée `{ seance_prevue_id, date, sport, statut: 'FAITE', duree_s, distance_m (repris de la séance), rpe, source: 'MANUEL', athlete_id }` → 2 actions. Sans durée prévue (C-08) : la feuille ajoute un champ « Durée (h:mm) » obligatoire, la note sélectionnée est surlignée et un bouton « Valider » crée la réalisation (3 actions).
- **Partielle** (C-09) : feuille avec RPE + champ durée réalisée obligatoire, prérempli avec la durée prévue, bouton « Valider ».
- **Sautée** (C-10) : 5 boutons de motif ; un toucher crée `{ statut: 'SAUTEE', motif }`.
- Toute création passe par `normaliserRealisation` puis `validerRealisation` (erreurs affichées dans la feuille), puis `creerRealisationUnique`. Les boutons de la feuille sont désactivés dès le premier toucher.
- Après création : fermeture de la feuille et nouveau rendu de E-01 (< 0,3 s).

- [ ] **Étape 1 : implémenter les trois feuilles**.
- [ ] **Étape 2 : `node --test`** → OK.
- [ ] **Étape 3 : vérifier dans le navigateur** : Faite + RPE en 2 touchers ; séance sans durée → 3 actions ; Partielle avec durée préremplie ; Sautée → badge « Sautée · Météo » ; pas de boutons sur une carte Repos ; **double toucher rapide sur une note → une seule réalisation dans IndexedDB** ; console vide.
- [ ] **Étape 4 : commit** « V1.1 : statut rapide Faite / Partielle / Sautée (F-21, F-23, C-06 à C-10, ENF-10) ».

---

### Tâche 11 : écran E-03 « Détails du réalisé »

**Fichiers :**
- Créer : `js/ui/realisation.js`
- Modifier : `js/app.js` (route `realisation`), `css/style.css`, `sw.js`, `js/ui/commun.js` (VERSION_APP)

**Interfaces :**
- Consomme : `lire`, `ecrire`, `supprimer` (tâche 7) ; `validerRealisation`, `normaliserRealisation`, `calculerAllure`, `lireDuree`, `formaterDuree`, `lireDistance`, `formaterDistanceSaisie` (tâches 2 à 4) ; `SPORTS`, `MOTIFS`, `ZONES_DOULEUR`, `LIBELLES_RPE`, `MESSAGES`, `formaterMessage` (tâche 5).
- Produit : `afficherRealisation(conteneur, contexte, segments, params) -> Promise<void>` (`segments[1]` = `'nouvelle'` ou id de réalisation).

Comportement (9.4.2) :
- Champs : statut (Faite / Partielle / Sautée), motif (si Sautée), durée h:mm, distance (km ou m), FC moyenne, puissance (affichée seulement si sport VELO), RPE (10 boutons), douleur (zone parmi `ZONES_DOULEUR` + intensité 1-5 ; « Aucune » par défaut), commentaire. Sautée masque les mesures.
- Allure affichée sous les champs, recalculée à chaque saisie avec `calculerAllure` (non stockée).
- Enregistrement auto comme E-02 (500 ms / sortie de champ), après `normaliserRealisation` + `validerRealisation` ; erreur → champ rouge + message, rien n'est écrit (C-14).
- **Nouvelle séance non prévue** (C-12) : choix du sport (boutons SPORTS sauf REPOS), statut FAITE fixé ; rien n'est créé tant que sport, durée et RPE ne sont pas valides ; à la création, `history.replaceState` vers `#/realisation/{id}`.
- **Réalisation existante** (C-11) : bouton « Effacer le statut » → `confirm(M-04)` → `supprimer('realisations', id)` → retour E-01.
- Bouton « Retour » → E-01 à la date de la réalisation.

- [ ] **Étape 1 : implémenter `afficherRealisation`**.
- [ ] **Étape 2 : `node --test`** → OK.
- [ ] **Étape 3 : vérifier dans le navigateur** : « Modifier » depuis une carte → ajout FC, douleur Genou 3, commentaire, recharger → conservés ; 10 km en 50:00 → « 5:00 /km » ; FC 231 → M-02 rouge ; passer en Sautée efface les mesures ; « Effacer le statut » → la carte retrouve ses boutons ; séance non prévue vélo 1:00 RPE 5 → visible sur E-01 ; puissance absente pour la course ; saisie complète chronométrée < 30 s. Console vide.
- [ ] **Étape 4 : commit** « V1.1 : détails du réalisé et séance non prévue (F-21, F-22, F-23, F-24, C-11, C-12, C-14) ».

---

### Tâche 12 : sauvegarde, restauration et suppression totale

**Fichiers :**
- Créer : `js/db/sauvegarde.js`, `js/ui/sauvegarde.js`
- Modifier : `js/app.js` (route `sauvegarde` + bandeau C-15 au démarrage), `js/ui/aujourdhui.js` (zone du bandeau en haut), `css/style.css`, `sw.js`, `js/ui/commun.js` (VERSION_APP)

**Interfaces :**
- Consomme : `listerTout`, `lire`, `ecrire`, `remplacerTout`, `viderTout` (tâche 7) ; `initialiser` (tâche 7) ; `verifierSauvegarde`, `SCHEMA_VERSION`, `STORES` (tâche 4).
- Produit (`db/sauvegarde.js`) :
  - `exporterDonnees() -> Promise<objet>` : format exact 9.6 (`app`, `schema_version`, `date_export` ISO UTC, `donnees` avec les 5 stores). Met à jour `meta.derniere_sauvegarde` **avant** de lire les stores, pour que le fichier exporté et la base restent identiques (ENF-18).
  - `importerDonnees(objet) -> Promise<boolean>` : `false` sans rien écrire si `verifierSauvegarde` échoue ; sinon `remplacerTout(objet.donnees)` puis `true`.
  - `joursDepuisSauvegarde() -> Promise<number|null>` (`null` = jamais).
  - `aDesDonnees() -> Promise<boolean>` (au moins une séance prévue ou une réalisation).
  - `toutSupprimer() -> Promise<{athleteId}>` : `viderTout()` puis `initialiser()` (état C-01, C-18).
- Produit (`ui/sauvegarde.js`) :
  - `afficherSauvegarde(conteneur, contexte) -> Promise<void>` : « Dernière sauvegarde : jj/mm/aaaa » ou « jamais » ; version `VERSION_APP` ; boutons « Exporter », « Importer » (`<input type="file" accept=".json,application/json">`), « Tout supprimer ».
  - `bandeauRappel(contexte) -> Promise<string>` : HTML du bandeau M-05 (« il y a X jours » / « jamais ») avec lien vers `#/sauvegarde`, ou chaîne vide. Affiché si `aDesDonnees()` et (jamais ou > `rappel_sauvegarde_jours` jours) (C-15, ENF-17).

Comportement :
- Exporter (C-16) : `confirm(M-06)` → `exporterDonnees()` → téléchargement `triathlon-sauvegarde-AAAA-MM-JJ.json` (Blob + lien `download`, nom avec `jourISO()`).
- Importer (C-17) : lecture du fichier ; `JSON.parse` en échec ou `importerDonnees` → `false` → `alert(M-08)` ; sinon `confirm(M-07)` **avant** l'écriture (contrôle du format d'abord, confirmation ensuite), puis retour E-01.
- Tout supprimer (C-18) : `prompt(M-09)` ; seule la saisie exacte « SUPPRIMER » déclenche `toutSupprimer()` puis retour E-01.

- [ ] **Étape 1 : implémenter `db/sauvegarde.js`** puis **`ui/sauvegarde.js`**, brancher la route et le bandeau.
- [ ] **Étape 2 : `node --test`** → OK.
- [ ] **Étape 3 : vérifier dans le navigateur** : avec des données et sans sauvegarde → bandeau « jamais » ; Exporter → M-06 puis fichier téléchargé, bandeau disparu, date affichée ; Tout supprimer avec « supprimer » (minuscules) → rien ; avec « SUPPRIMER » → base réinitialisée ; Importer le fichier exporté → M-07 → données identiques (comparer les séances et réalisations) ; importer un `.json` quelconque → M-08 et données intactes. Console vide.
- [ ] **Étape 4 : commit** « V1.1 : export, import et suppression des données (F-36, C-15 à C-18, ENF-17, ENF-18, ENF-23, ENF-24) ».

---

### Tâche 13 : recette du lot et mise à jour de CLAUDE.md

**Fichiers :**
- Modifier : `CLAUDE.md` (section 11), éventuellement les fichiers à corriger

- [ ] **Étape 1 : lancer le skill `recette` (V1.1)** : `node --test`, contrôle des imports (chaque nom importé est exporté par le module cible), règles de couches, absence d'URL externe (`grep -rn "http" js/ index.html sw.js` ne doit montrer aucune URL), messages M-xx et bornes conformes, VERSION cohérente.
- [ ] **Étape 2 : contrôle hors ligne sur PC** : serveur local, charger l'app, F12 → Network → « Offline », recharger → l'application fonctionne (consultation, saisie, modification) ; Network sans aucune requête sortante hors localhost (ENF-21, ENF-22).
- [ ] **Étape 3 : corriger les écarts trouvés** (une correction = un commit citant l'identifiant concerné, VERSION incrémentée).
- [ ] **Étape 4 : mettre à jour la section 11** de `CLAUDE.md` : V1.1 « Code écrit, recette PC faite ; tests sur téléphone à faire » ; prochaine étape : tests manuels 9.7 sur Android et iPhone, mise en ligne sur GitHub Pages, puis 2 semaines d'usage avant V1.2.
- [ ] **Étape 5 : commit** « V1.1 : recette PC et état d'avancement ».

Les tests 👤 (installation Android/iPhone, mode avion sur téléphone, mise en ligne GitHub Pages) restent à faire par l'utilisateur.

---

## Correspondance spécification → tâches

| Exigence | Tâche(s) |
|---|---|
| F-10, F-11, F-13 | 9 (affichage 8) |
| F-20 | 8 |
| F-21, F-23 | 10, 11 |
| F-22, F-24 | 11 |
| F-35 | 7 |
| F-36 | 4, 12 |
| C-01 | 7 · C-02, C-19 : 8 · C-03 à C-05, C-13 : 9 · C-06 à C-10 : 10 · C-11, C-12 : 11 · C-14 : 4, 9, 11 · C-15 à C-18 : 12 |
| ENF-01, 02, 05, 21, 22 | 6, 13 |
| ENF-10 | 10 · ENF-11, 12, 14 : 6, 8 · ENF-16 : 9, 11 · ENF-17, 18, 23, 24 : 12 · ENF-19, 27, 28 : 7 · ENF-20 : 1, 4 |
| Tests 9.7 automatiques | bornes : 1 · h:mm : 2 · allure : 3 · sauvegardes : 4 |
