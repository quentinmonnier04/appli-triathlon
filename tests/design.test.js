// Fonctions pures ajoutées pour le design E (D-20) : jauge de forme, semaine ISO, dates courtes, unités, total de la semaine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { positionJauge } from '../js/logique/forme.js';
import { numeroSemaine, libelleJourCourt } from '../js/logique/dates.js';
import { formaterDateCourte, decouperUnite } from '../js/logique/format.js';
import { totauxSemaine } from '../js/logique/totaux.js';
import { SPORTS, sport } from '../js/logique/sports.js';

test('jauge de forme : bornes de 9.4 aux limites des segments', () => {
  assert.equal(positionJauge(-30), 25);
  assert.equal(positionJauge(-10), 50);
  assert.equal(positionJauge(5), 75);
  assert.equal(positionJauge(-7), 55); // maquette : repère vers 56 %
  assert.equal(positionJauge(-100), 0);
  assert.equal(positionJauge(60), 100);
  assert.equal(positionJauge(null), null);
});

test('jauge de forme : chaque phrase tombe dans son segment', () => {
  assert.ok(positionJauge(-31) < 25);
  assert.ok(positionJauge(-20) > 25 && positionJauge(-20) < 50);
  assert.ok(positionJauge(6) > 75);
});

test('numéro de semaine ISO', () => {
  assert.equal(numeroSemaine('2026-11-24'), 48);
  assert.equal(numeroSemaine('2026-01-01'), 1); // jeudi
  assert.equal(numeroSemaine('2027-01-01'), 53); // vendredi : dernière semaine de 2026
  assert.equal(numeroSemaine('2024-12-30'), 1); // lundi de la semaine 1 de 2025
});

test('libellé du jour court', () => {
  assert.equal(libelleJourCourt('2026-11-24'), 'Mardi 24 nov.');
  assert.equal(libelleJourCourt('2026-08-02'), 'Dimanche 2 août');
});

test('date courte des cartes', () => {
  assert.equal(formaterDateCourte('2026-11-20', '07:30'), 'Ven. 20/11 · 07:30');
  assert.equal(formaterDateCourte('2026-11-19', null), 'Jeu. 19/11');
});

test('valeur et unité séparées', () => {
  assert.deepEqual(decouperUnite('48,38 km'), { valeur: '48,38', unite: 'km' });
  assert.deepEqual(decouperUnite('1 500 m'), { valeur: '1 500', unite: 'm' });
  assert.deepEqual(decouperUnite('5:01 /km'), { valeur: '5:01', unite: '/km' });
  assert.deepEqual(decouperUnite('1:39:34'), { valeur: '1:39:34', unite: '' });
  assert.deepEqual(decouperUnite('1:52 /100 m'), { valeur: '1:52', unite: '/100 m' });
  assert.equal(decouperUnite(null), null);
});

test('total de la semaine', () => {
  assert.deepEqual(totauxSemaine([{ realise_s: 600, prevu_s: 1200 }, { realise_s: 300, prevu_s: 0 }]), { realise_s: 900, prevu_s: 1200 });
  assert.deepEqual(totauxSemaine([]), { realise_s: 0, prevu_s: 0 });
});

test('sports : icône SVG nommée (pas d\'emoji) et couleur du design E', () => {
  for (const s of SPORTS) assert.match(s.icone, /^[a-z]+$/, s.code);
  assert.equal(sport('CAP').couleur, '#3DDC84');
  assert.equal(sport('VELO').couleur, '#FF7A1A');
  assert.equal(sport('NATATION').couleur, '#3FA7FF');
  assert.equal(sport('RENFO').couleur, '#B98CFF');
});
