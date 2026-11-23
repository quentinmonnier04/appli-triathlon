// Plan à surcharge progressive (F-82, F-83, F-84, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REGLAGES_PAR_DEFAUT, plafondParDefaut, lundisDuPlan, coefficientsPlan, validerReglages,
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
