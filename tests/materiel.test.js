// Matériel et usure (lot LC2 : F-125 à F-128, ENF-24) : données inventées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceDepuis, usure, arbreMateriel, alertesUsure, materielsPourSport, lireLimiteKm, libelleType,
} from '../js/logique/materiel.js';
import { convertirMateriel, convertirSeanceMateriel } from '../js/api/materiel.js';

const seances = [
  { id: 'a1', date: '2026-03-01', gear_id: 'b1', distance_m: 50000 },
  { id: 'a2', date: '2026-06-01', gear_id: 'b1', distance_m: 80000 },
  { id: 'a3', date: '2026-10-01', gear_id: 'b1', distance_m: 100000 },
  { id: 'a4', date: '2026-10-05', gear_id: 's1', distance_m: 12000 },
  { id: 'a5', date: '2026-10-06', gear_id: null, distance_m: 9000 },
];

test('distance d\'un matériel, depuis une date incluse', () => {
  assert.equal(distanceDepuis(seances, 'b1'), 230000);
  assert.equal(distanceDepuis(seances, 'b1', '2026-06-01'), 180000);
  assert.equal(distanceDepuis(seances, 'zz'), 0);
});

test('usure d\'une pièce : séances du vélo depuis la pose ou le dernier remplacement', () => {
  const chaine = { id: 'c1', achat: '2026-01-01', rappels: [{ id: 7, distance_m: 200000, dernier_remplacement: '2026-05-15' }] };
  const u = usure(chaine, seances, 'b1');
  assert.deepEqual([u.km, u.limite_km, u.pct, u.depuis], [180, 200, 90, '2026-05-15']);
  const sansRappel = usure({ id: 'b1', achat: null, rappels: [] }, seances);
  assert.deepEqual([sansRappel.km, sansRappel.limite_km, sansRappel.pct], [230, null, null]);
});

test('arbre du matériel, alertes d\'usure, matériel par sport', () => {
  const materiels = [
    { id: 'b1', type: 'Bike', nom: 'Vélo route', achat: '2026-01-01', retire: null, est_piece: false, pieces_ids: ['c1', 'p1'], rappels: [] },
    { id: 'c1', type: 'Chain', nom: 'Chaîne', achat: '2026-01-01', retire: null, est_piece: true, pieces_ids: [], rappels: [{ id: 1, distance_m: 200000, dernier_remplacement: null }] },
    { id: 'p1', type: 'Tyre', nom: 'Pneu arrière', achat: '2026-09-01', retire: null, est_piece: true, pieces_ids: [], rappels: [{ id: 2, distance_m: 4000000, dernier_remplacement: null }] },
    { id: 's1', type: 'Shoes', nom: 'Chaussures', achat: '2026-08-01', retire: null, est_piece: false, pieces_ids: [], rappels: [{ id: 3, distance_m: 10000, dernier_remplacement: null }] },
    { id: 'old', type: 'Shoes', nom: 'Vieilles', achat: '2025-01-01', retire: '2026-01-01', est_piece: false, pieces_ids: [], rappels: [] },
  ];
  const arbre = arbreMateriel(materiels, seances);
  assert.deepEqual(arbre.map((m) => m.id), ['b1', 's1']);
  assert.equal(arbre[0].total_km, 230);
  assert.deepEqual(arbre[0].pieces.map((p) => [p.id, p.usure.km, p.usure.pct]), [['c1', 230, 115], ['p1', 100, 3]]);
  assert.deepEqual(alertesUsure(arbre).map((a) => [a.nom, a.pct, a.parent]), [['Chaîne', 115, 'Vélo route'], ['Chaussures', 120, null]]);
  assert.deepEqual(materielsPourSport(arbre, 'VELO').map((m) => m.id), ['b1']);
  assert.deepEqual(materielsPourSport(arbre, 'NATATION'), []);
});

test('limite saisie en km, libellés', () => {
  assert.deepEqual(lireLimiteKm('3 000'), { metres: 3000000 });
  assert.deepEqual(lireLimiteKm(''), { metres: null });
  assert.ok(lireLimiteKm('2').erreur);
  assert.ok(lireLimiteKm('abc').erreur);
  assert.equal(libelleType('Chain'), 'Chaîne');
  assert.equal(libelleType('Wetsuit'), 'Wetsuit');
});

test('conversions des réponses (simulées) d\'Intervals.icu', () => {
  const m = convertirMateriel({
    id: 'b9', type: 'Bike', name: 'Vélo <b>test</b>', purchased: '2026-02-03T00:00:00', retired: null, component: false, component_ids: ['c9'],
    reminders: [{ id: 4, distance: 3000000, last_reset: '2026-05-01T10:00:00' }, { id: 5, days: 365 }],
  });
  assert.deepEqual(m, {
    id: 'b9', type: 'Bike', nom: 'Vélo <b>test</b>', achat: '2026-02-03', retire: null, est_piece: false, pieces_ids: ['c9'],
    rappels: [{ id: 4, distance_m: 3000000, dernier_remplacement: '2026-05-01' }, { id: 5, distance_m: null, dernier_remplacement: null }],
  });
  assert.deepEqual(convertirSeanceMateriel({ id: 1, start_date_local: '2026-10-01T08:00:00', distance: 40000, gear: { id: 'b9', name: 'x' } }),
    { id: '1', date: '2026-10-01', gear_id: 'b9', distance_m: 40000 });
  assert.equal(convertirSeanceMateriel({ id: 2, start_date_local: '2026-10-01T08:00:00' }).gear_id, null);
});

test('D-44 : un matériel principal compte aussi ses séances antérieures à son achat ; une pièce, depuis sa pose', () => {
  const velo = { id: 'b1', achat: '2026-11-27', rappels: [] };
  assert.equal(usure(velo, seances).km, 230); // vélo ajouté aujourd'hui : ses sorties passées comptent
  const chaussures = { id: 's1', achat: '2026-11-27', rappels: [{ id: 3, distance_m: 700000, dernier_remplacement: null }] };
  assert.equal(usure(chaussures, seances).km, 12);
  const piece = { id: 'c1', achat: '2026-09-01', rappels: [{ id: 1, distance_m: 2000000, dernier_remplacement: null }] };
  assert.equal(usure(piece, seances, 'b1').km, 100); // seulement depuis la pose
});

import { dateLue, formatsDate, DATE_SANS_POSE } from '../js/logique/materiel.js';
test('D-46 : dates lues et envoyées', () => {
  assert.equal(dateLue('2025-11-27T00:00:00'), '2025-11-27');
  assert.equal(dateLue('2025-11-27'), '2025-11-27');
  assert.equal(dateLue(DATE_SANS_POSE), null); // "sans date de pose"
  assert.equal(dateLue('1999-05-01'), null);
  assert.equal(dateLue(null), null);
  assert.deepEqual(formatsDate('2025-11-27'), ['2025-11-27', '2025-11-27T00:00:00']);
});
