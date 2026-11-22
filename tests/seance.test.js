// Séance structurée -> texte au format Intervals.icu (F-41, F-42, ENF-24)
// Syntaxe vérifiée sur le forum officiel : "- " pour une étape, m = minutes, mtr = mètres, km,
// "Titre Nx" pour une répétition entourée de lignes vides, Z4 = puissance, Z4 HR = FC, Z4 Pace = allure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dureeTexte, distanceTexte, cibleTexte, blocsVersTexte, texteVersBlocs, cibleParDefaut, sportVersType,
  lireDureeSaisie, lireDureeEtape, validerSeance, dureeTotaleBlocs, CIBLES, formaterDureeSaisie, formaterDureeEtape, modeleParDefaut,
} from '../js/logique/seance.js';

test('durées : h, m et s sans zéros inutiles ("m" = minutes)', () => {
  assert.equal(dureeTexte(3600), '1h');
  assert.equal(dureeTexte(5400), '1h30m');
  assert.equal(dureeTexte(600), '10m');
  assert.equal(dureeTexte(90), '1m30s');
  assert.equal(dureeTexte(45), '45s');
  assert.equal(dureeTexte(3725), '1h2m5s');
});

test('distances : km si multiple de 1000, sinon mtr ; toujours mtr en natation', () => {
  assert.equal(distanceTexte(1000, 'CAP'), '1km');
  assert.equal(distanceTexte(20000, 'VELO'), '20km');
  assert.equal(distanceTexte(400, 'CAP'), '400mtr');
  assert.equal(distanceTexte(1500, 'CAP'), '1500mtr');
  assert.equal(distanceTexte(1000, 'NATATION'), '1000mtr');
});

test('cibles : puissance, FC, allure ; sans zone, pas de cible', () => {
  assert.equal(cibleTexte(4, 'POWER'), 'Z4');
  assert.equal(cibleTexte(2, 'HR'), 'Z2 HR');
  assert.equal(cibleTexte(3, 'PACE'), 'Z3 Pace');
  assert.equal(cibleTexte(null, 'HR'), '');
  assert.deepEqual(CIBLES.map((c) => c.code), ['HR', 'PACE', 'POWER']);
});

test('cible par défaut selon le sport et type Intervals.icu', () => {
  assert.equal(cibleParDefaut('VELO'), 'HR');
  assert.equal(cibleParDefaut('CAP'), 'PACE');
  assert.equal(cibleParDefaut('NATATION'), 'PACE');
  assert.equal(cibleParDefaut('RENFO'), 'HR');
  assert.equal(sportVersType('NATATION'), 'Swim');
  assert.equal(sportVersType('VELO'), 'Ride');
  assert.equal(sportVersType('CAP'), 'Run');
  assert.equal(sportVersType('RENFO'), 'WeightTraining');
  assert.equal(sportVersType('AUTRE'), 'Other');
});

const fractionne = [
  { type: 'ECHAUFFEMENT', cible: 'HR', etape: { duree_s: 900, zone: 2 } },
  { type: 'REPETITIONS', cible: 'PACE', repetitions: 6, effort: { distance_m: 800, zone: 4 }, recup: { duree_s: 120, zone: 1 } },
  { type: 'CONTINU', cible: 'HR', etape: { duree_s: 600, zone: 3 } },
  { type: 'RETOUR_CALME', cible: 'HR', etape: { duree_s: 600, zone: 1 } },
];

test('blocs -> texte de séance (F-42), répétitions entourées de lignes vides', () => {
  assert.equal(blocsVersTexte(fractionne, 'CAP'), [
    'Échauffement', '- 15m Z2 HR', '',
    'Série 6x', '- 800mtr Z4 Pace', '- Récup 2m Z1 Pace', '',
    'Corps de séance', '- 10m Z3 HR', '',
    'Retour au calme', '- 10m Z1 HR',
  ].join('\n'));
});

test('répétition sans récupération ; étape sans zone', () => {
  assert.equal(blocsVersTexte([{ type: 'REPETITIONS', cible: 'POWER', repetitions: 3, effort: { duree_s: 600, zone: null }, recup: null }], 'VELO'),
    'Série 3x\n- 10m');
});

test('texte -> blocs : relecture exacte de ce que génère l\'appli', () => {
  assert.deepEqual(texteVersBlocs(blocsVersTexte(fractionne, 'CAP')), fractionne);
  const natation = [{ type: 'REPETITIONS', cible: 'PACE', repetitions: 10, effort: { distance_m: 100, zone: 3 }, recup: { duree_s: 20, zone: null } }];
  assert.deepEqual(texteVersBlocs(blocsVersTexte(natation, 'NATATION')), natation);
  assert.deepEqual(texteVersBlocs('Série 4x\n- 1km Z4\n- Récup 1m30s Z1'), [
    { type: 'REPETITIONS', cible: 'POWER', repetitions: 4, effort: { distance_m: 1000, zone: 4 }, recup: { duree_s: 90, zone: 1 } }]);
});

test('texte non produit par l\'appli : pas de blocs (description libre)', () => {
  assert.equal(texteVersBlocs(''), null);
  assert.equal(texteVersBlocs(null), null);
  assert.equal(texteVersBlocs('Sortie tranquille avec les copains'), null);
  assert.equal(texteVersBlocs('Warmup\n- 20m 60% 90-100rpm'), null);
});

test('saisie des durées : h:mm, 1h30, minutes seules ; m:ss pour une étape', () => {
  assert.equal(lireDureeSaisie('1:30'), 5400);
  assert.equal(lireDureeSaisie('1h30'), 5400);
  assert.equal(lireDureeSaisie('1h'), 3600);
  assert.equal(lireDureeSaisie('45'), 2700);
  assert.equal(lireDureeSaisie('1:75'), null);
  assert.equal(lireDureeSaisie(''), null);
  assert.equal(lireDureeEtape('4:00'), 240);
  assert.equal(lireDureeEtape('1:30'), 90);
  assert.equal(lireDureeEtape('10'), 600);
  assert.equal(lireDureeEtape('0:20'), 20);
  assert.equal(lireDureeEtape('2:75'), null);
});

test('durée totale des blocs (étapes en distance non comptées)', () => {
  assert.equal(dureeTotaleBlocs(fractionne), 900 + 6 * 120 + 600 + 600);
  assert.equal(dureeTotaleBlocs([]), 0);
});

test('validation : titre, date, répétitions 1 à 50, étapes avec durée ou distance', () => {
  const ok = { date: '2026-11-24', sport: 'CAP', titre: 'Fractionné', blocs: fractionne };
  assert.deepEqual(validerSeance(ok), {});
  assert.ok(validerSeance({ ...ok, titre: '  ' }).titre);
  assert.ok(validerSeance({ ...ok, date: '' }).date);
  assert.ok(validerSeance({ ...ok, blocs: [{ ...fractionne[1], repetitions: 0 }] })['blocs.0']);
  assert.ok(validerSeance({ ...ok, blocs: [{ ...fractionne[1], repetitions: 51 }] })['blocs.0']);
  assert.ok(validerSeance({ ...ok, blocs: [{ type: 'ECHAUFFEMENT', cible: 'HR', etape: { zone: 2 } }] })['blocs.0']);
  assert.deepEqual(validerSeance({ date: '2026-11-24', sport: 'VELO', titre: 'Sortie', blocs: [] }), {});
});

test('préremplissage des champs : h:mm pour la séance, m:ss pour une étape', () => {
  assert.equal(formaterDureeSaisie(5400), '1:30');
  assert.equal(formaterDureeSaisie(2700), '0:45');
  assert.equal(formaterDureeSaisie(null), '');
  assert.equal(formaterDureeEtape(240), '4:00');
  assert.equal(formaterDureeEtape(20), '0:20');
  assert.equal(formaterDureeEtape(null), '');
  assert.equal(lireDureeSaisie(formaterDureeSaisie(5400)), 5400);
  assert.equal(lireDureeEtape(formaterDureeEtape(95)), 95);
});

test("modèle de départ d'une séance structurée : valide et dans la cible du sport (R-02 : programmer en moins d'une minute)", () => {
  const blocs = modeleParDefaut('CAP');
  assert.deepEqual(blocs.map((b) => b.type), ['ECHAUFFEMENT', 'REPETITIONS', 'RETOUR_CALME']);
  assert.ok(blocs.every((b) => b.cible === 'PACE'));
  assert.deepEqual(validerSeance({ date: '2026-11-24', sport: 'CAP', titre: 'x', blocs }), {});
  assert.equal(modeleParDefaut('VELO')[0].cible, 'HR');
});
