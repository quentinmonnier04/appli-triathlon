// Logique de l'agenda (F-30 à F-35, ENF-20)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodeAgenda, deplacerPeriode, libellePeriode, elementsParJour, VUES } from '../js/logique/agenda.js';
import { totauxPeriode } from '../js/logique/totaux.js';

test('vues disponibles', () => {
  assert.deepEqual(VUES.map((v) => v.code), ['mois', 'semaine', '30j']);
});

test('période affichée selon la vue', () => {
  assert.deepEqual(periodeAgenda('mois', '2026-11-22'), { debut: '2026-11-01', fin: '2026-11-30' });
  assert.deepEqual(periodeAgenda('semaine', '2026-11-22'), { debut: '2026-11-16', fin: '2026-11-22' });
  assert.deepEqual(periodeAgenda('30j', '2026-11-22'), { debut: '2026-10-24', fin: '2026-11-22' });
  assert.deepEqual(periodeAgenda('inconnue', '2026-11-22'), { debut: '2026-11-01', fin: '2026-11-30' });
});

test('période précédente et suivante', () => {
  assert.equal(deplacerPeriode('mois', '2026-11-22', -1), '2026-10-01');
  assert.equal(deplacerPeriode('mois', '2026-01-31', -1), '2025-12-01');
  assert.equal(deplacerPeriode('mois', '2026-12-05', 1), '2027-01-01');
  assert.equal(deplacerPeriode('semaine', '2026-11-22', 1), '2026-11-29');
  assert.equal(deplacerPeriode('30j', '2026-11-22', -1), '2026-10-23');
});

test('libellé de la période (jj/mm/aaaa)', () => {
  assert.equal(libellePeriode('mois', '2026-11-01', '2026-11-30'), 'novembre 2026');
  assert.equal(libellePeriode('semaine', '2026-11-16', '2026-11-22'), '16/11 au 22/11/2026');
  assert.equal(libellePeriode('semaine', '2026-12-28', '2027-01-03'), '28/12/2026 au 03/01/2027');
});

test('séances prévues et activités regroupées par jour (F-31, F-34)', () => {
  const r = elementsParJour(
    [{ id: 'a1', date: '2026-11-20', heure: '18:00' }, { id: 'a2', date: '2026-11-20', heure: '07:00' }],
    [{ id: 'p1', date: '2026-11-20' }, { id: 'p2', date: '2026-11-21' }],
  );
  assert.deepEqual(r['2026-11-20'].activites.map((a) => a.id), ['a2', 'a1']);
  assert.deepEqual(r['2026-11-20'].prevues.map((p) => p.id), ['p1']);
  assert.deepEqual(r['2026-11-21'], { prevues: [{ id: 'p2', date: '2026-11-21' }], activites: [] });
});

test('totaux de la période (F-33) : valeurs absentes = 0', () => {
  assert.deepEqual(totauxPeriode([
    { duree_s: 3600, distance_m: 10000, denivele_m: 120 },
    { duree_s: 1800, distance_m: null, denivele_m: null },
  ]), { duree_s: 5400, distance_m: 10000, denivele_m: 120, nombre: 2 });
  assert.deepEqual(totauxPeriode([]), { duree_s: 0, distance_m: 0, denivele_m: 0, nombre: 0 });
});
