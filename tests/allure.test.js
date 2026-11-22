// Tests du calcul de l'allure par sport (4.4, 9.7)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculerAllure } from '../js/regles/validation.js';

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

test("pas d'allure sans données ou pour renfo/repos", () => {
  assert.equal(calculerAllure('CAP', 3000, null), null);
  assert.equal(calculerAllure('CAP', 0, 10000), null);
  assert.equal(calculerAllure('RENFO', 3000, 1000), null);
});
