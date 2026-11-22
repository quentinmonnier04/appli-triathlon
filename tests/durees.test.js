// Tests des conversions durée h:mm et distance (D-09, 9.7)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  lireDuree, formaterDuree, lireDureeCourte, formaterDureeCourte, lireDistance, formaterDistanceSaisie,
} from '../js/regles/validation.js';

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
