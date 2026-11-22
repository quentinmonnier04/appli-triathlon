// Dates locales (ENF-20 : semaine du lundi au dimanche)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  jourISO, ajouterJours, lundiDe, debutMois, memeJourMoisPrecedent, joursDansMois, grilleMois, libelleMois,
} from '../js/logique/dates.js';

test("jourISO en heure locale (pas en UTC)", () => {
  assert.equal(jourISO(new Date(2026, 10, 22, 23, 45)), '2026-11-22');
});

test('ajouterJours traverse mois et changement d\'heure', () => {
  assert.equal(ajouterJours('2026-10-25', 1), '2026-10-26');
  assert.equal(ajouterJours('2026-11-01', -1), '2026-10-31');
});

test('lundi de la semaine (lundi au dimanche)', () => {
  assert.equal(lundiDe('2026-11-22'), '2026-11-16'); // dimanche
  assert.equal(lundiDe('2026-11-16'), '2026-11-16'); // lundi
  assert.equal(lundiDe('2026-11-18'), '2026-11-16');
});

test('début de mois, même jour du mois précédent (borné), nombre de jours', () => {
  assert.equal(debutMois('2026-11-22'), '2026-11-01');
  assert.equal(memeJourMoisPrecedent('2026-11-22'), '2026-10-22');
  assert.equal(memeJourMoisPrecedent('2026-03-31'), '2026-02-28');
  assert.equal(memeJourMoisPrecedent('2026-01-15'), '2025-12-15');
  assert.equal(joursDansMois('2026-02-10'), 28);
  assert.equal(joursDansMois('2028-02-10'), 29);
});

test('grille du mois : semaines du lundi au dimanche, cases vides hors du mois', () => {
  const g = grilleMois('2026-11-22'); // novembre 2026 commence un dimanche
  assert.equal(g[0].length, 7);
  assert.deepEqual(g[0].slice(5), [null, '2026-11-01']);
  assert.equal(g[g.length - 1].filter(Boolean).pop(), '2026-11-30');
  assert.equal(g.flat().filter(Boolean).length, 30);
});

test('libellé du mois en français', () => {
  assert.equal(libelleMois('2026-11-22'), 'novembre 2026');
});
