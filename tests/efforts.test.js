// Analyse calculée par l'appli (lot LC3 : F-129, F-130, ENF-24) : flux inventés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meilleuresMoyennes, meilleursTemps, tempsParZone, bornesZones, histogrammeFlux, courbeDepuisFlux, resumeEfforts, agregerRecords,
} from '../js/logique/efforts.js';

const serie = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test('meilleures moyennes : sprint, effort de 5 min, durées trop longues ignorées', () => {
  const watts = serie(3600, (i) => (i >= 1000 && i < 1300 ? 320 : 180));
  watts[2000] = 1100;
  const r = meilleuresMoyennes(watts, [1, 300, 1200, 7200]);
  assert.deepEqual(r.map((x) => [x.duree, x.valeur]), [[1, 1100], [300, 320], [1200, 216]]);
  assert.deepEqual([r[1].debut_i, r[1].fin_i], [1000, 1299]);
  assert.deepEqual(meilleuresMoyennes([], [1]), []);
});

test('meilleures moyennes de FC : une fenêtre avec un trou est écartée', () => {
  const fc = serie(120, (i) => (i < 60 ? 150 : 170));
  fc[90] = null;
  const r = meilleuresMoyennes(fc, [30], { zeroSiVide: false });
  assert.equal(r[0].valeur, 170);
  assert.ok(r[0].fin_i < 90 || r[0].debut_i > 90);
});

test('meilleurs temps sur une distance (deux curseurs)', () => {
  const temps = serie(3000, (i) => i);
  const distance = serie(3000, (i) => (i < 1000 ? i * 3 : 3000 + (i - 1000) * 4)); // 3 m/s puis 4 m/s
  const r = meilleursTemps(distance, temps, [400, 1000, 9000, 20000]);
  assert.deepEqual(r.map((x) => [x.distance, x.temps_s]), [[400, 100], [1000, 250], [9000, 2334]]);
});

test('temps par zone, pauses ignorées ; bornes depuis les réglages', () => {
  const fc = [100, 140, 160, 180, null];
  assert.deepEqual(tempsParZone(fc, [0, 1, 2, 3, 4], [130, 150, Infinity]), [1, 1, 2]);
  const temps = [0, 1, 400, 401];
  assert.deepEqual(tempsParZone([100, 100, 100, 100], temps, [200]), [4]); // la pause ne compte que pour 1 s
  assert.deepEqual(bornesZones('puissance', [55, 75, 999], 200), [110, 150, Infinity]);
  assert.deepEqual(bornesZones('fc', [130, 150, 999]), [130, 150, Infinity]);
  assert.deepEqual(bornesZones('allure', [80, 100], 4), [3.2, 4]);
  assert.deepEqual(bornesZones('puissance', [55], null), []);
});

test('histogramme au format des réponses d\'Intervals.icu', () => {
  assert.deepEqual(histogrammeFlux([10, 20, 30, 60, null, -5], null, 25), [{ start: 0, secs: 2 }, { start: 25, secs: 1 }, { start: 50, secs: 1 }]);
});

test('courbes de puissance et d\'allure, résumé et records agrégés', () => {
  const flux = { watts: serie(600, () => 250), time: serie(600, (i) => i), distance: serie(600, (i) => i * 5) };
  const c = courbeDepuisFlux(flux, 'puissance');
  assert.equal(c[0].x, 1);
  assert.ok(c.every((p) => p.y === 250));
  const a = courbeDepuisFlux(flux, 'allure');
  assert.equal(a[0].x, 100);
  assert.equal(a[0].y, 5);
  const resume = resumeEfforts({ ...flux, heartrate: serie(600, () => 150) }, { durees: [60, 300], dureesFc: [60], distances: [400, 1000] });
  assert.deepEqual(resume, { puissance: { 60: 250, 300: 250 }, fc: { 60: 150 }, temps: { 400: 80, 1000: 200 } });
  const records = agregerRecords([
    { id: 'a', poids_kg: 70, resume: { puissance: { 60: 300 }, fc: {}, temps: { 1000: 230 } } },
    { id: 'b', poids_kg: 71, resume: { puissance: { 60: 350, 300: 280 }, fc: { 60: 175 }, temps: { 1000: 240 } } },
  ], { durees: [60, 300, 1200], dureesFc: [60], distances: [1000] });
  assert.deepEqual(records.puissance.map((r) => [r.duree, r.valeur, r.activite_id, r.poids_kg]), [[60, 350, 'b', 71], [300, 280, 'b', 71]]);
  assert.deepEqual(records.allure.map((r) => [r.distance, r.temps_s, r.activite_id]), [[1000, 230, 'a']]);
  assert.deepEqual(records.fc.map((r) => r.valeur), [175]);
});

import { analyseSeance, courbePeriode } from '../js/logique/efforts.js';
test('analyse d\'une séance par l\'appli : zones avec les seuils de la séance, sinon les réglages', () => {
  const flux = { time: serie(100, (i) => i), watts: serie(100, (i) => (i < 50 ? 100 : 300)), heartrate: serie(100, () => 140) };
  const a = { seuils: { ftp: 200 }, bornes_zones: { puissance: [55, 75, 999], fc: null } };
  const r = analyseSeance(a, flux, { zones_fc: [130, 150, 999] });
  assert.deepEqual(r.zones_puissance, [50, 0, 50]); // 100 W < 110 W (Z1) ; 300 W au-delà de 150 W (Z3)
  assert.deepEqual(r.zones_fc, [0, 100, 0]);
  assert.equal(r.zones_allure, null);
  assert.equal(r.puissance[0].valeur, 300);
  assert.ok(r.histo_puissance.length >= 2);
});
test('courbe d\'une période à partir des résumés des séances', () => {
  const resumes = [{ resume: { puissance: { 1: 900, 60: 400 }, temps: { 1000: 240 } } }, { resume: { puissance: { 1: 800, 60: 420 }, temps: { 1000: 230 } } }];
  assert.deepEqual(courbePeriode(resumes, 'puissance'), [{ x: 1, y: 900 }, { x: 60, y: 420 }]);
  assert.deepEqual(courbePeriode(resumes, 'allure'), [{ x: 1000, y: 1000 / 230 }]);
});
