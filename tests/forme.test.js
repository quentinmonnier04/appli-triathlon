// Forme (F-23, 9.4) : phrase selon TSB
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phraseForme, calculerTsb, derniereForme } from '../js/logique/forme.js';

test('phrase selon TSB, bornes de 9.4 incluses', () => {
  assert.equal(phraseForme(12), 'Frais');
  assert.equal(phraseForme(5.1), 'Frais');
  assert.equal(phraseForme(5), 'Équilibré');
  assert.equal(phraseForme(-10), 'Équilibré');
  assert.equal(phraseForme(-10.1), 'En charge');
  assert.equal(phraseForme(-30), 'En charge');
  assert.equal(phraseForme(-30.1), 'Fatigue élevée');
  assert.equal(phraseForme(null), null);
});

test('TSB = CTL - ATL', () => {
  assert.equal(calculerTsb(52.4, 61.9), -9.5);
  assert.equal(calculerTsb(null, 10), null);
});

test('dernière forme connue : la plus récente avec CTL et ATL', () => {
  const liste = [
    { date: '2026-11-20', ctl: 50, atl: 55, tsb: -5 },
    { date: '2026-11-22', ctl: null, atl: null, tsb: null },
    { date: '2026-11-21', ctl: 51, atl: 58, tsb: -7 },
  ];
  assert.equal(derniereForme(liste).date, '2026-11-21');
  assert.equal(derniereForme([]), null);
});
