// Plan à surcharge progressive (F-82, F-83, F-84, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REGLAGES_PAR_DEFAUT, plafondParDefaut, lundisDuPlan, coefficientsPlan, validerReglages,
  lireReglagesSaisis, lundiSuivant, bornesPlan, debutEffectif, surchargerSeance, volumeSeance_s, volumeSemaine_s, distanceSansAllure, genererPlan, prefixePlan, externalId,
} from '../js/logique/plan.js';

const types = (plan) => plan.map((s) => [s.type[0], s.pct]);

test('exemple validé de la spec (12 semaines)', () => {
  const p = coefficientsPlan(12, { ...REGLAGES_PAR_DEFAUT }, 18000);
  assert.deepEqual(types(p), [
    ['H', 100], ['H', 108], ['H', 116], ['C', 81], ['H', 116], ['H', 124], ['H', 132], ['C', 92],
    ['H', 132], ['H', 140], ['A', 98], ['C', 70],
  ]);
  assert.equal(p.at(-1).type, 'COURSE');
  assert.deepEqual(p.map((s) => s.numero), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('plan très court : course dans 1 ou 2 semaines', () => {
  assert.deepEqual(coefficientsPlan(1, REGLAGES_PAR_DEFAUT, 18000), [{ numero: 1, type: 'COURSE', pct: 50 }]);
  assert.deepEqual(coefficientsPlan(2, REGLAGES_PAR_DEFAUT, 18000).map((s) => s.pct), [70, 50]);
  assert.deepEqual(coefficientsPlan(0, REGLAGES_PAR_DEFAUT, 18000), []);
});

test('plafond sous la base : hausses au plafond, coupures et affûtage en dessous', () => {
  // base 5 h, plafond 4 h -> 80 %
  const p = coefficientsPlan(6, { ...REGLAGES_PAR_DEFAUT, plafond_h: 4 }, 18000);
  assert.deepEqual(p.map((s) => s.pct), [80, 80, 80, 56, 56, 40]);
});

test('plafond atteint en cours de plan, sans affûtage', () => {
  // base 5 h, plafond 6 h -> 120 %
  const p = coefficientsPlan(8, { ...REGLAGES_PAR_DEFAUT, affutage: [], plafond_h: 6 }, 18000);
  assert.deepEqual(p.map((s) => s.pct), [100, 108, 116, 81, 116, 120, 120, 84]);
  assert.equal(p.at(-1).type, 'COURSE');
});

test('semaine type vide : pas de plafond, pas d\'erreur', () => {
  assert.equal(coefficientsPlan(4, { ...REGLAGES_PAR_DEFAUT, plafond_h: 5 }, 0)[0].pct, 100);
});

test('lundis du plan', () => {
  assert.deepEqual(lundisDuPlan('2026-11-30', '2026-12-16'), ['2026-11-30', '2026-12-07', '2026-12-14']);
  assert.deepEqual(lundisDuPlan('2026-12-02', '2026-12-07'), ['2026-11-30', '2026-12-07']);
  assert.deepEqual(lundisDuPlan('2026-11-30', '2026-11-20'), []);
});

test('plafond par défaut : 1,5 fois la semaine type, arrondi à l\'heure supérieure', () => {
  assert.equal(plafondParDefaut(18000), 8);
  assert.equal(plafondParDefaut(0), 1);
});

test('validation des réglages', () => {
  const ok = { ...REGLAGES_PAR_DEFAUT, debut: '2026-11-30' };
  assert.deepEqual(validerReglages(ok), {});
  assert.deepEqual(validerReglages({ ...ok, plafond_h: 8, affutage: [] }), {});
  assert.ok(validerReglages({ ...ok, coupure: 10 }).coupure);
  assert.ok(validerReglages({ ...ok, hausse: 31 }).hausse);
  assert.ok(validerReglages({ ...ok, semainesHausse: 0 }).semainesHausse);
  assert.ok(validerReglages({ ...ok, affutage: [70, 60, 50, 40, 30] }).affutage);
  assert.ok(validerReglages({ ...ok, affutage: [10] }).affutage);
  assert.ok(validerReglages({ ...ok, plafond_h: 0 }).plafond_h);
  assert.ok(validerReglages({ ...ok, debut: '30/11' }).debut);
});

// --- Surcharge des séances et génération (Task 2) ---

const rep = { id: 'w1', jour: 2, sport: 'CAP', titre: 'Fractionné', blocs: [
  { type: 'ECHAUFFEMENT', cible: 'PACE', etape: { duree_s: 900, zone: 2 } },
  { type: 'REPETITIONS', cible: 'PACE', repetitions: 5, effort: { duree_s: 240, zone: 4 }, recup: { duree_s: 120, zone: 1 } },
  { type: 'CONTINU', cible: 'PACE', etape: { distance_m: 3000, zone: 2 } }] };

test('règle mixte : continu en durée, répétitions en nombre, distance, zones inchangées', () => {
  const s = surchargerSeance(rep, 120);
  assert.equal(s.blocs[0].etape.duree_s, 1080);
  assert.equal(s.blocs[1].repetitions, 6);
  assert.equal(s.blocs[1].effort.duree_s, 240);
  assert.equal(s.blocs[1].recup.duree_s, 120);
  assert.equal(s.blocs[2].etape.distance_m, 3500);
  assert.equal(s.blocs[1].effort.zone, 4);
  assert.equal(s.blocs[0].cible, 'PACE');
  assert.equal(rep.blocs[1].repetitions, 5); // la séance type n'est pas modifiée
});

test("arrondis : 5 min au-delà d'une heure, au moins 1 répétition, 100 m en natation", () => {
  assert.equal(surchargerSeance({ sport: 'VELO', titre: 'Longue', duree_s: 7200 }, 108).duree_s, 7800);
  assert.equal(surchargerSeance({ sport: 'CAP', titre: 'Footing', duree_s: 2700 }, 108).duree_s, 2940);
  assert.equal(surchargerSeance({ ...rep, blocs: [{ ...rep.blocs[1], repetitions: 1 }] }, 50).blocs[0].repetitions, 1);
  assert.equal(surchargerSeance({ sport: 'NATATION', titre: 'Nage', distance_m: 2000 }, 108).distance_m, 2200);
  assert.deepEqual(surchargerSeance({ sport: 'REPOS', titre: 'Repos' }, 150), { sport: 'REPOS', titre: 'Repos' });
});

test('à 100 %, la séance est recopiée sans arrondi', () => {
  const s = { sport: 'VELO', titre: 'Longue', duree_s: 7776 };
  assert.deepEqual(surchargerSeance(s, 100), s);
});

test("volume : distance convertie avec l'allure seuil, sinon signalée", () => {
  assert.equal(volumeSeance_s(rep, { CAP: 4 }), 900 + 5 * 360 + 750);
  assert.equal(volumeSeance_s(rep, {}), 900 + 5 * 360);
  assert.equal(volumeSeance_s({ sport: 'NATATION', distance_m: 2000 }, { NATATION: 1 }), 2000);
  assert.equal(volumeSeance_s({ sport: 'REPOS', titre: 'Repos' }, {}), 0);
  assert.equal(volumeSemaine_s([rep, { sport: 'VELO', duree_s: 3600 }], { CAP: 4 }), 3450 + 3600);
  assert.equal(distanceSansAllure([rep], {}), true);
  assert.equal(distanceSansAllure([rep], { CAP: 4 }), false);
  assert.equal(distanceSansAllure([{ sport: 'NATATION', distance_m: 2000 }], {}), true);
});

test('étiquette des séances du plan', () => {
  assert.equal(prefixePlan('77'), 'plan-77-');
  assert.equal(externalId('77', 3, '2026-12-08', 1), 'plan-77-s3-2026-12-08-1');
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

test('génération : dates, ordre, surcharge, repos recopié, volume réel', () => {
  const semaineType = [
    { id: 'a', jour: 7, sport: 'VELO', titre: 'Longue', duree_s: 7200 },
    { id: 'b', jour: 1, sport: 'REPOS', titre: 'Repos' },
    { id: 'c', jour: 3, sport: 'CAP', titre: 'Footing', duree_s: 2700 },
  ];
  const plan = genererPlan({ semaineType, reglages: { ...REGLAGES_PAR_DEFAUT, debut: '2026-11-30' },
    dateCourse: '2027-02-21', allures: {}, objectifId: '9' }); // 12 semaines, course un dimanche
  assert.equal(plan.length, 12);
  const s2 = plan[1];
  assert.equal(s2.lundi, '2026-12-07');
  assert.equal(s2.pct, 108);
  assert.deepEqual(s2.seances.map((s) => [s.date, s.titre]), [
    ['2026-12-07', 'Repos'], ['2026-12-09', 'Footing S2'], ['2026-12-13', 'Longue S2']]);
  assert.equal(s2.seances[2].duree_s, 7800);
  assert.equal(s2.volume_s, 2940 + 7800);
  assert.equal(s2.seances[0].jour, undefined);
  assert.equal(plan.at(-1).seances.some((s) => s.date >= '2027-02-21'), false);
});

test('génération : course avant le début, semaine type vide', () => {
  assert.deepEqual(genererPlan({ semaineType: [rep], reglages: { ...REGLAGES_PAR_DEFAUT, debut: '2026-11-30' },
    dateCourse: '2026-11-01', allures: {}, objectifId: '1' }), []);
  const vide = genererPlan({ semaineType: [], reglages: { ...REGLAGES_PAR_DEFAUT, debut: '2026-11-30' },
    dateCourse: '2026-12-20', allures: {}, objectifId: '1' });
  assert.equal(vide.length, 3);
  assert.equal(vide.every((s) => s.seances.length === 0 && s.volume_s === 0), true);
});

test('lecture du formulaire des réglages', () => {
  assert.deepEqual(lireReglagesSaisis({ hausse: '8', semainesHausse: '3', coupure: '70', affutage: '70, 50', plafond: '7,5', debut: '2026-11-30' }),
    { hausse: 8, semainesHausse: 3, coupure: 70, affutage: [70, 50], plafond_h: 7.5, debut: '2026-11-30' });
  const r = lireReglagesSaisis({ hausse: 'x', semainesHausse: '3', coupure: '70', affutage: '', plafond: '', debut: '' });
  assert.ok(Number.isNaN(r.hausse));
  assert.deepEqual(r.affutage, []);
  assert.equal(r.plafond_h, null);
  assert.equal(r.debut, null);
  assert.ok(validerReglages(r).hausse);
  assert.ok(validerReglages(lireReglagesSaisis({ hausse: '8', semainesHausse: '3', coupure: '70', affutage: '70 x', plafond: 'abc', debut: '2026-11-30' })).affutage);
});

test('lundi suivant', () => {
  assert.equal(lundiSuivant('2026-11-23'), '2026-11-30'); // un lundi
  assert.equal(lundiSuivant('2026-11-29'), '2026-11-30'); // un dimanche
});

test('bornes : début reculé, la suppression part quand même du lundi suivant (revue I-1)', () => {
  assert.deepEqual(bornesPlan('2026-11-23', '2026-12-14'), { creation: '2026-12-14', regeneration: '2026-11-30', suppression: '2026-11-24' });
  assert.deepEqual(bornesPlan('2026-11-25', '2026-11-30'), { creation: '2026-11-30', regeneration: '2026-11-30', suppression: '2026-11-26' });
  // début dans le passé : la semaine en cours n'est jamais régénérée
  assert.equal(bornesPlan('2026-12-02', '2026-11-30').creation, '2026-12-07');
});

test("début du plan propre à l'objectif (revue I-4)", () => {
  assert.equal(debutEffectif({ debut: '2026-11-30', objectifDebut: '77' }, '77', '2026-12-07'), '2026-11-30');
  assert.equal(debutEffectif({ debut: '2026-05-04', objectifDebut: '12' }, '77', '2026-12-07'), '2026-12-07');
  assert.equal(debutEffectif({ debut: null, objectifDebut: null }, '77', '2026-12-07'), '2026-12-07');
});
