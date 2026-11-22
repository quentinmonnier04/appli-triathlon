// Tests du formatage (9.4, ENF-20, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  echapperHtml, formaterDuree, formaterDistance, formaterVitesse, formaterDateHeure, formaterHorodatage, formaterEntier,
} from '../js/logique/format.js';

test("echapperHtml neutralise le HTML venant de l'API", () => {
  assert.equal(echapperHtml('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  assert.equal(echapperHtml("l'eau & co"), 'l&#39;eau &amp; co');
  assert.equal(echapperHtml(null), '');
});

test("durée : h:mm:ss au-delà d'une heure, mm:ss sinon (9.4)", () => {
  assert.equal(formaterDuree(5974), '1:39:34');
  assert.equal(formaterDuree(2712), '45:12');
  assert.equal(formaterDuree(3600), '1:00:00');
  assert.equal(formaterDuree(59), '0:59');
  assert.equal(formaterDuree(null), null);
});

test('distance : km à 2 décimales, mètres pour la natation (9.4)', () => {
  assert.equal(formaterDistance(48380, 'VELO'), '48,38 km');
  assert.equal(formaterDistance(10000, 'CAP'), '10,00 km');
  assert.equal(formaterDistance(1500, 'NATATION'), '1 500 m');
  assert.equal(formaterDistance(750.4, 'NATATION'), '750 m');
  assert.equal(formaterDistance(0, 'CAP'), null);
  assert.equal(formaterDistance(null, 'CAP'), null);
});

test('vitesse vélo en km/h, allure course en min/km, natation en min/100 m (9.4)', () => {
  assert.equal(formaterVitesse('VELO', 48380, 6000), '29,0 km/h');
  assert.equal(formaterVitesse('CAP', 10000, 3120), '5:12 /km');
  assert.equal(formaterVitesse('NATATION', 1500, 1770), '1:58 /100 m');
  assert.equal(formaterVitesse('RENFO', 1000, 600), null);
  assert.equal(formaterVitesse('CAP', 0, 600), null);
  assert.equal(formaterVitesse('CAP', 1000, null), null);
});

test('date et heure en jj/mm/aaaa (ENF-20)', () => {
  assert.equal(formaterDateHeure('2026-11-20', '07:30'), 'Vendredi 20/11/2026 à 07:30');
  assert.equal(formaterDateHeure('2026-11-22', null), 'Dimanche 22/11/2026');
});

test('horodatage pour M-03 en heure locale', () => {
  const d = new Date(2026, 10, 22, 8, 5);
  assert.deepEqual(formaterHorodatage(d.toISOString()), { 'jj/mm': '22/11', 'hh:mm': '08:05' });
});

test('entiers avec séparateur de milliers', () => {
  assert.equal(formaterEntier(1234), '1 234');
  assert.equal(formaterEntier(87.6), '88');
  assert.equal(formaterEntier(null), null);
});
