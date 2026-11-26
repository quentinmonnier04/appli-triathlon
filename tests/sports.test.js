// Correspondance types Intervals.icu -> sports de l'appli (9.3, ENF-18)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPORTS, sportDepuisType, sport } from '../js/logique/sports.js';

test('natation : piscine et eau libre', () => {
  assert.equal(sportDepuisType('Swim'), 'NATATION');
  assert.equal(sportDepuisType('OpenWaterSwim'), 'NATATION');
});

test('vélo : route, home trainer, VTT, gravel', () => {
  for (const t of ['Ride', 'VirtualRide', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'TrackRide', 'Cyclocross']) assert.equal(sportDepuisType(t), 'VELO', t);
});

test('course : route, trail, tapis virtuel', () => {
  for (const t of ['Run', 'TrailRun', 'VirtualRun']) assert.equal(sportDepuisType(t), 'CAP', t);
});

test('renfo, enchaînement et autres', () => {
  assert.equal(sportDepuisType('WeightTraining'), 'RENFO');
  assert.equal(sportDepuisType('Crossfit'), 'RENFO');
  assert.equal(sportDepuisType('Transition'), 'ENCHAINEMENT');
  assert.equal(sportDepuisType('Walk'), 'AUTRE');
  assert.equal(sportDepuisType('Hike'), 'AUTRE');
  assert.equal(sportDepuisType('TypeInconnu'), 'AUTRE');
  assert.equal(sportDepuisType(undefined), 'AUTRE');
});

test('chaque sport a une couleur et une icône (9.3)', () => {
  assert.deepEqual(SPORTS.map((s) => s.code), ['NATATION', 'VELO', 'CAP', 'RENFO', 'ENCHAINEMENT', 'REPOS', 'AUTRE']);
  assert.equal(sport('VELO').couleur, '#FF7A1A');
  assert.equal(sport('AUTRE').icone, 'autre');
  for (const s of SPORTS) assert.ok(s.couleur && s.icone && s.libelle, s.code);
});

import { estVirtuelle } from '../js/logique/sports.js';
test('séance virtuelle : types Virtual... seulement (D-30)', () => {
  for (const t of ['VirtualRide', 'VirtualRun', 'VirtualRow']) assert.equal(estVirtuelle(t), true, t);
  for (const t of ['Ride', 'Run', 'Swim', '', null, undefined]) assert.equal(estVirtuelle(t), false, String(t));
});
