// Charge et forme calculées par l'appli (lot LC1 : F-120, F-121, F-131, ENF-24) : données inventées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  puissanceNormalisee, chargePuissance, chargeAllure, chargeFc, chargeRpe, chargeSeance, fluxPourCharge,
  formeQuotidienne, chargesSemaines, phraseBilan,
} from '../js/logique/charge.js';
import { ajouterJours } from '../js/logique/dates.js';

const serie = (n, f) => Array.from({ length: n }, (_, i) => f(i));

test('puissance normalisée : égale à la puissance si elle est constante, plus haute si elle varie', () => {
  assert.equal(puissanceNormalisee(serie(600, () => 200)), 200);
  const variable = serie(600, (i) => (Math.floor(i / 60) % 2 ? 300 : 100)); // moyenne 200 W
  assert.ok(puissanceNormalisee(variable) > 220);
  assert.equal(puissanceNormalisee(serie(20, () => 200)), null);
  // Une pause (saut de temps) coupe la moyenne glissante sans fausser le résultat.
  const temps = serie(600, (i) => (i < 300 ? i : i + 600));
  assert.equal(puissanceNormalisee(serie(600, () => 250), temps), 250);
});

test('charge à la puissance : 1 h à la FTP = 100', () => {
  assert.equal(chargePuissance(3600, 250, 250), 100);
  assert.equal(chargePuissance(3600, 200, 250), 64);
  assert.equal(chargePuissance(1800, 250, 250), 50);
  assert.equal(chargePuissance(3600, 200, null), null);
});

test('charge à l\'allure : course au carré, natation au cube', () => {
  assert.equal(chargeAllure(3600, 14400, 4), 100); // 1 h à la vitesse seuil
  assert.equal(chargeAllure(3600, 12960, 4), 81); // 90 % du seuil
  assert.equal(chargeAllure(3600, 4320, 1.2, 3), 100); // natation à la CSS
  assert.equal(chargeAllure(3600, 3888, 1.2, 3), 73); // 90 % de la CSS : 0,9^3
  assert.equal(chargeAllure(3600, 0, 4), null);
});

test('charge à la FC : 1 h à la FC seuil = 100, pauses et trous ignorés', () => {
  assert.equal(chargeFc(serie(3600, () => 165), null, 165), 100);
  assert.equal(chargeFc(serie(3600, () => 132), null, 165), 64);
  const temps = serie(3600, (i) => (i < 1800 ? i : i + 900));
  assert.equal(chargeFc(serie(3600, () => 165), temps, 165), 100);
  assert.equal(chargeFc([null, 0], null, 165), null);
  assert.equal(chargeFc(serie(10, () => 150), null, null), null);
});

test('charge au RPE : RPE 10 pendant 1 h = 100', () => {
  assert.equal(chargeRpe(3600, 10), 100);
  assert.equal(chargeRpe(3600, 6), 64);
  assert.equal(chargeRpe(3600, 0), null);
  assert.equal(chargeRpe(3600, null), null);
});

test('méthode retenue par sport : la première possible', () => {
  const watts = serie(3600, () => 250);
  const fc = serie(3600, () => 150);
  const velo = { sport: 'VELO', duree_s: 3600, seuils: { ftp: 250, fc_seuil: 165 } };
  assert.deepEqual(chargeSeance(velo, { watts, heartrate: fc }), { charge: 100, methode: 'puissance' });
  assert.equal(chargeSeance(velo, { heartrate: fc }).methode, 'fc');
  assert.deepEqual(chargeSeance({ ...velo, rpe: 5 }, {}), { charge: 56, methode: 'rpe' });
  assert.deepEqual(chargeSeance({ sport: 'VELO', duree_s: 3600, seuils: {} }, {}), { charge: null, methode: null });
  const cap = { sport: 'CAP', duree_s: 3600, distance_m: 14400, seuils: { vitesse_seuil: 4, fc_seuil: 170 } };
  assert.equal(chargeSeance(cap, { heartrate: fc }).methode, 'allure');
  assert.equal(chargeSeance({ sport: 'RENFO', duree_s: 3600, rpe: 6, seuils: {} }, {}).methode, 'rpe');
});

test('flux à télécharger : seulement ceux dont la méthode a besoin', () => {
  const velo = { sport: 'VELO', seuils: { ftp: 250, fc_seuil: 165 } };
  assert.deepEqual(fluxPourCharge(velo, ['time', 'watts', 'heartrate', 'latlng']), ['time', 'watts', 'heartrate']);
  assert.deepEqual(fluxPourCharge({ sport: 'NATATION', seuils: { vitesse_seuil: 1.2 } }, ['time', 'heartrate']), []);
  assert.deepEqual(fluxPourCharge({ sport: 'VELO', seuils: {} }, ['time', 'watts']), []);
});

test('forme : CTL et ATL exponentielles, TSB = CTL - ATL, charges du même jour additionnées', () => {
  const charges = serie(200, (i) => ({ date: ajouterJours('2026-01-01', i), charge: 50 }));
  const f = formeQuotidienne(charges, '2026-01-01', ajouterJours('2026-01-01', 199));
  const fin = f.at(-1);
  assert.ok(fin.ctl >= 48 && fin.ctl <= 50, `CTL ${fin.ctl}`); // charge constante : CTL tend vers 50
  assert.equal(fin.atl, 50);
  assert.equal(fin.tsb, fin.ctl - fin.atl);
  const deux = formeQuotidienne([{ date: '2026-03-01', charge: 40 }, { date: '2026-03-01', charge: 30 }], '2026-03-01', '2026-03-01');
  assert.equal(deux[0].atl, Math.round(70 * (1 - Math.exp(-1 / 7))));
});

test('bilan de la semaine : charge, moyenne des 4 précédentes, phrase', () => {
  const charges = [
    { date: '2026-11-16', charge: 80 }, { date: '2026-11-19', charge: 70 }, // semaine du 16
    { date: '2026-11-09', charge: 60 }, { date: '2026-11-02', charge: 60 }, { date: '2026-10-26', charge: 60 }, { date: '2026-10-19', charge: 60 },
  ];
  assert.deepEqual(chargesSemaines(charges, '2026-11-16'), { semaine: 150, moyenne4: 60 });
  assert.match(phraseBilan(150, 60, -5), /très chargée/);
  assert.match(phraseBilan(70, 60, -5), /chargée/);
  assert.match(phraseBilan(60, 60, 0), /régulière/);
  assert.match(phraseBilan(30, 60, 10), /légère/);
  assert.match(phraseBilan(60, 60, -35), /très chargée/);
  assert.match(phraseBilan(0, 60, 10), /sans séance/);
  assert.match(phraseBilan(50, 0, 0), /Première/);
});

import { bilanDeLaSemaine } from '../js/logique/charge.js';
import { convertirSeanceCharge, cleCalcul } from '../js/api/charge.js';

test('bilan de la semaine passée : volumes par sport, charge, phrase', () => {
  const b = bilanDeLaSemaine({
    charges: [{ date: '2026-11-17', charge: 90 }, { date: '2026-11-10', charge: 60 }, { date: '2026-11-03', charge: 60 }, { date: '2026-10-27', charge: 60 }, { date: '2026-10-20', charge: 60 }],
    activites: [{ date: '2026-11-17', sport: 'VELO', duree_s: 3600 }, { date: '2026-11-24', sport: 'CAP', duree_s: 1800 }],
    prevues: [{ date: '2026-11-18', sport: 'VELO', duree_s: 5400 }, { date: '2026-11-19', sport: 'CAP', duree_s: 2400 }],
    lundi: '2026-11-16',
  });
  assert.equal(b.dimanche, '2026-11-22');
  assert.deepEqual(b.lignes.map((l) => [l.sport, l.realise_s, l.prevu_s]), [['VELO', 3600, 5400], ['CAP', 0, 2400]]);
  assert.equal(b.realise_s, 3600);
  assert.equal(b.charge, 90);
  assert.equal(b.moyenne4, 60);
  assert.match(b.phrase, /très chargée/);
});

test('séance à calculer (réponse simulée) : seuils de la séance, sinon réglages actuels ; clé de recalcul', () => {
  const reglages = [{ sport: 'VELO', ftp_w: 240, fc_seuil: 160, allure_seuil_ms: null }];
  const s = convertirSeanceCharge({ id: 7, start_date_local: '2026-11-20T08:00:00', type: 'Ride', moving_time: 3600, distance: 30000, icu_ftp: 250, stream_types: ['watts'], icu_training_load: 80 }, reglages);
  assert.deepEqual(s.seuils, { ftp: 250, fc_seuil: 160, vitesse_seuil: null });
  assert.equal(s.id, '7');
  assert.equal(s.charge_intervals, 80);
  const autre = convertirSeanceCharge({ id: 7, start_date_local: '2026-11-20T08:00:00', type: 'Ride', moving_time: 3600, distance: 30000, icu_ftp: 260 }, reglages);
  assert.notEqual(cleCalcul(s), cleCalcul(autre)); // une FTP différente fait recalculer
});

import { ecartsCharges } from '../js/logique/charge.js';
test('écart moyen entre la charge de l\'appli et celle d\'Intervals.icu', () => {
  assert.deepEqual(ecartsCharges([{ charge: 100, charge_intervals: 90 }, { charge: 50, charge_intervals: 60 }, { charge: null, charge_intervals: 40 }]),
    { nb: 2, ecart_moyen: 10, ecart_pct: 13 });
  assert.equal(ecartsCharges([{ charge: 10, charge_intervals: null }]), null);
});
