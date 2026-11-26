// Courbes de performance (lots LA et LP : F-105, F-110 à F-114, ENF-24) : réponses d'Intervals.icu simulées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  codeCourbe, periodeValide, pointsAuxDurees, tempsAuxDistances, activiteDuRecord, debutPeriode,
} from '../js/logique/performances.js';
import { convertirRecords } from '../js/api/performances.js';
import { distancesAChercher } from '../js/logique/analyse.js';

test('codes de période de l\'API (description de power-curves)', () => {
  assert.equal(codeCourbe('42j', '2026-11-26'), '42d');
  assert.equal(codeCourbe('90j', '2026-11-26'), '90d');
  assert.equal(codeCourbe('annee', '2026-11-26'), 'r.2026-01-01.2026-11-26');
  assert.equal(codeCourbe('tout', '2026-11-26'), 'all');
  assert.equal(periodeValide('<b>'), '42j');
  assert.equal(periodeValide('tout'), 'tout');
  assert.equal(debutPeriode('42j', '2026-11-26'), '2026-10-16');
  assert.equal(debutPeriode('tout', '2026-11-26'), null);
});

test('puissance : points aux durées demandées, durée exacte ou juste au-delà, records absents ignorés', () => {
  const courbe = { secs: [1, 2, 5, 15, 30, 60, 330, 1200], values: [900, 850, 700, 520, 450, 380, 300, 260], activity_id: ['a1', 'a1', 'a2', 'a2', 'a2', 'a3', 'a3', 'a4'] };
  const p = pointsAuxDurees(courbe, [1, 5, 300, 1200, 3600]);
  assert.deepEqual(p.map((x) => [x.duree, x.valeur, x.activite_id]), [[1, 900, 'a1'], [5, 700, 'a2'], [300, 300, 'a3'], [1200, 260, 'a4']]);
  assert.deepEqual(pointsAuxDurees({ secs: [1, 600], values: [800, 250] }, [60]), []); // 600 s est trop loin de 60 s
  assert.deepEqual(pointsAuxDurees(null, [1]), []);
});

test('allure : temps aux distances (à 1 % près), temps invraisemblables écartés', () => {
  const courbe = { distance: [400, 1000, 4990, 10000], values: [88, 238, 1290, 2700], activity_id: ['r1', 'r1', 'r2', 'r3'], start_index: [10, 5, 0, 0], end_index: [98, 243, 1290, 2700] };
  const t = tempsAuxDistances(courbe, [400, 1000, 5000, 21097]);
  assert.deepEqual(t.map((x) => [x.distance, x.temps_s, x.activite_id, x.debut_i]), [[400, 88, 'r1', 10], [1000, 238, 'r1', 5], [5000, 1290, 'r2', 0]]);
  // Une valeur qui serait une vitesse (m/s) et non un temps est écartée.
  assert.deepEqual(tempsAuxDistances({ distance: [1000], values: [4] }, [1000]), []);
});

test('records datés avec la table des activités ; poids du jour pour les W/kg', () => {
  const reponse = {
    list: [{ secs: [1, 5], values: [880, 690], activity_id: ['i1', 'i2'], weight: 70.5 }],
    activities: { i1: { id: 'i1', start_date_local: '2026-10-02T08:00:00', name: 'Sortie A' }, i2: { id: 'i2', start_date_local: '2026-11-12T17:30:00', name: 'Sortie B' } },
  };
  const r = convertirRecords(reponse, 'puissance', 'VELO');
  assert.equal(r.poids_kg, 70.5);
  assert.deepEqual(r.records.map((x) => [x.duree, x.valeur, x.date, x.titre]), [[1, 880, '2026-10-02', 'Sortie A'], [5, 690, '2026-11-12', 'Sortie B']]);
  assert.deepEqual(convertirRecords(null, 'allure', 'CAP'), { records: [], poids_kg: null });
  assert.deepEqual(activiteDuRecord({}, 'x'), { date: null, titre: null });
});

test('distances cherchées dans une séance, limitées à la distance parcourue', () => {
  assert.deepEqual(distancesAChercher({ sport: 'CAP', distance_m: 10020 }), [400, 1000, 5000, 10000]);
  assert.deepEqual(distancesAChercher({ sport: 'NATATION', distance_m: 1500 }), [100, 200, 400, 1000, 1500]);
  assert.deepEqual(distancesAChercher({ sport: 'VELO', distance_m: 40000 }), []);
  assert.deepEqual(distancesAChercher({ sport: 'CAP', distance_m: null }), []);
});
