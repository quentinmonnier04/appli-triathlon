// Logique du fil et du détail des activités (F-10, F-12, F-13, ENF-11)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrerParSport, repartitionZones, estPerime, fusionnerActivites } from '../js/logique/activites.js';

const liste = [
  { id: 'a', sport: 'CAP', date: '2026-11-20', heure: '07:30' },
  { id: 'b', sport: 'VELO', date: '2026-11-19', heure: '18:00' },
  { id: 'c', sport: 'CAP', date: '2026-11-18', heure: '12:00' },
];

test('filtre par sport (F-12) ; sans filtre, tout est gardé', () => {
  assert.deepEqual(filtrerParSport(liste, 'CAP').map((a) => a.id), ['a', 'c']);
  assert.equal(filtrerParSport(liste, null).length, 3);
});

test('répartition des zones : pourcentage, zones vides retirées en fin de liste', () => {
  assert.deepEqual(repartitionZones([600, 1800, 600, 0, 0]), [
    { zone: 'Z1', secs: 600, pct: 20 }, { zone: 'Z2', secs: 1800, pct: 60 }, { zone: 'Z3', secs: 600, pct: 20 },
  ]);
  assert.deepEqual(repartitionZones([0, 0]), []);
  assert.deepEqual(repartitionZones(null), []);
});

test('zones de puissance au format {id, secs} : seules Z1 à Z7 sont gardées', () => {
  assert.deepEqual(repartitionZones([{ id: 'Z1', secs: 300 }, { id: 'Z2', secs: 900 }, { id: 'SS', secs: 200 }]),
    [{ zone: 'Z1', secs: 300, pct: 25 }, { zone: 'Z2', secs: 900, pct: 75 }]);
});

test('cache périmé après 5 minutes (ENF-11)', () => {
  const maintenant = Date.parse('2026-11-22T10:00:00Z');
  assert.equal(estPerime('2026-11-22T09:56:00Z', maintenant), false);
  assert.equal(estPerime('2026-11-22T09:54:59Z', maintenant), true);
  assert.equal(estPerime(null, maintenant), true);
});

test('fusion des pages : pas de doublon, ordre du plus récent au plus ancien', () => {
  const page2 = [{ id: 'c', sport: 'CAP', date: '2026-11-18', heure: '12:00' }, { id: 'd', sport: 'NATATION', date: '2026-11-17', heure: '06:45' }];
  assert.deepEqual(fusionnerActivites(liste, page2).map((a) => a.id), ['a', 'b', 'c', 'd']);
});
