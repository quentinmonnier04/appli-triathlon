// Tracés GPS (F-70, F-71, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decouperSegments, nombrePoints, alleger, limites, cheminApercu } from '../js/logique/carte.js';
import { convertirActivite, convertirTrace, CHAMPS_FIL, POINTS_CARTE } from '../js/api/activites.js';

test('latlngs -> segments : un point absent coupe le tracé ; points invalides et (0, 0) ignorés', () => {
  const latlngs = [[45, 5], [45.1, 5.1], null, [45.2, 5.2], [45.3, 5.3], [0, 0], [45.4, 5.4], [91, 5], [45.5, 5.5], [45.6, 5.6]];
  assert.deepEqual(decouperSegments(latlngs), [
    [[45, 5], [45.1, 5.1]], [[45.2, 5.2], [45.3, 5.3]], [[45.5, 5.5], [45.6, 5.6]],
  ]);
  assert.deepEqual(decouperSegments(null), []);
  assert.deepEqual(decouperSegments([[45, 5]]), []);
});

test('allègement : premier et dernier point gardés, nombre de points réduit', () => {
  const s = Array.from({ length: 1000 }, (_, i) => [45 + i / 1000, 5]);
  const a = alleger([s], 100);
  assert.ok(nombrePoints(a) <= 101);
  assert.deepEqual(a[0][0], s[0]);
  assert.deepEqual(a[0].at(-1), s.at(-1));
  assert.equal(alleger([s], 5000)[0].length, 1000);
});

test('limites du tracé', () => {
  assert.deepEqual(limites([[[45, 5], [46, 4]], [[44, 6]]]), [[44, 4], [46, 6]]);
  assert.equal(limites([]), null);
});

test('chemin de l\'aperçu : tracé centré, nord en haut, proportions gardées (F-71)', () => {
  // Aller-retour plein nord sur 0,01 degré : ligne verticale au centre du cadre.
  const d = cheminApercu([[[45, 5], [45.01, 5]]], 100, 60, 5);
  assert.equal(d, 'M50,55 L50,5');
  assert.equal(cheminApercu([], 100, 60), '');
  // Un tracé réduit à un point ne fait pas d'erreur.
  assert.equal(cheminApercu([[[45, 5], [45, 5]]], 100, 60), 'M50,30 L50,30');
});

test('activité avec tracé GPS : stream_types contient latlng (F-70, F-71)', () => {
  assert.ok(CHAMPS_FIL.includes('stream_types'));
  assert.equal(convertirActivite({ id: 'i1', stream_types: ['time', 'latlng'] }).a_gps, true);
  assert.equal(convertirActivite({ id: 'i2', stream_types: ['time', 'heartrate'] }).a_gps, false);
  assert.equal(convertirActivite({ id: 'i3' }).a_gps, false);
  // D-30 : séance virtuelle (MyWhoosh, Zwift) : positions du monde virtuel, pas de carte.
  assert.equal(convertirActivite({ id: 'i4', type: 'VirtualRide', stream_types: ['latlng'] }).a_gps, false);
  assert.equal(convertirActivite({ id: 'i5', type: 'Ride', stream_types: ['latlng'] }).a_gps, true);
});

test('MapData -> tracé interne allégé', () => {
  const latlngs = Array.from({ length: 10000 }, (_, i) => [45 + i / 1e5, 5]);
  const t = convertirTrace({ latlngs, bounds: [[45, 5], [45.1, 5]] });
  assert.ok(nombrePoints(t.segments) <= POINTS_CARTE + 1);
  assert.deepEqual(convertirTrace(null), { segments: [] });
});
