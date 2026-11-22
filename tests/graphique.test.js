// Petite courbe cumulée (F-22) et progression (F-25)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheminCourbe, progression } from '../js/logique/graphique.js';

test('chemin SVG : x réparti sur le mois, y inversé (0 en bas)', () => {
  // 3 points sur un mois de 3 jours, max 100, zone 200 x 50
  assert.equal(cheminCourbe([0, 50, 100], 3, 100, 200, 50), 'M0,50 L100,25 L200,0');
});

test('chemin SVG : courbe partielle (mois en cours) et maximum nul', () => {
  assert.equal(cheminCourbe([10, 20], 5, 20, 100, 40), 'M0,20 L25,0');
  assert.equal(cheminCourbe([0, 0], 2, 0, 100, 40), 'M0,40 L100,40');
  assert.equal(cheminCourbe([], 30, 10, 100, 40), '');
});

test('progression réalisé / prévu en %, bornée à 100', () => {
  assert.equal(progression(1800, 3600), 50);
  assert.equal(progression(5400, 3600), 100);
  assert.equal(progression(1800, 0), null);
});
