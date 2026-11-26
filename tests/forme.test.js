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

// --- Historique de la forme (F-26) ---
import {
  periodeForme, serieForme, echelleForme, ordonnee, cheminForme, bandesTsb, resumeForme,
} from '../js/logique/forme.js';

test('période de l\'historique : 3 mois par défaut, code inconnu refusé, fin incluse', () => {
  assert.deepEqual(periodeForme('6s', '2026-11-26'), { code: '6s', libelle: '6 semaines', debut: '2026-10-16', fin: '2026-11-26' });
  assert.equal(periodeForme('1a', '2026-11-26').debut, '2025-11-27');
  assert.equal(periodeForme('<script>', '2026-11-26').code, '3m');
  assert.equal(periodeForme(undefined, '2026-11-26').debut, '2026-08-28');
});

test('série : jours sans CTL ou ATL retirés, ordre chronologique', () => {
  const s = serieForme([
    { date: '2026-11-03', ctl: 40, atl: 50, tsb: -10 },
    { date: '2026-11-01', ctl: 38, atl: 30, tsb: 8 },
    { date: '2026-11-02', ctl: null, atl: 45, tsb: null },
  ]);
  assert.deepEqual(s.map((f) => f.date), ['2026-11-01', '2026-11-03']);
});

test('échelle : marge de 10 % (au moins 1), zéro inclus si demandé, série vide', () => {
  assert.deepEqual(echelleForme([10, 30]), { min: 8, max: 32 });
  assert.deepEqual(echelleForme([10, 30], { avecZero: true }), { min: -3, max: 33 });
  assert.deepEqual(echelleForme([5, 5]), { min: 4, max: 6 });
  assert.deepEqual(echelleForme([]), { min: 0, max: 1 });
});

test('ordonnée : max en haut, min en bas', () => {
  const e = { min: 0, max: 100 };
  assert.equal(ordonnee(100, e, 140), 0);
  assert.equal(ordonnee(0, e, 140), 140);
  assert.equal(ordonnee(50, e, 140), 70);
});

test('chemin : x selon la date, jour manquant sauté', () => {
  const periode = { debut: '2026-11-01', fin: '2026-11-05' };
  const serie = [
    { date: '2026-11-01', ctl: 0 },
    { date: '2026-11-03', ctl: 50 },
    { date: '2026-11-05', ctl: 100 },
  ];
  assert.equal(cheminForme(serie, 'ctl', periode, { min: 0, max: 100 }, 300, 140), 'M0,140 L150,70 L300,0');
  assert.equal(cheminForme([], 'ctl', periode, { min: 0, max: 100 }, 300, 140), '');
});

test('bandes du TSB aux bornes de 9.4, limitées à l\'échelle', () => {
  const b = bandesTsb({ min: -40, max: 20 }, 60);
  assert.deepEqual(b, [
    { numero: 1, y: 50, hauteur: 10 },
    { numero: 2, y: 30, hauteur: 20 },
    { numero: 3, y: 15, hauteur: 15 },
    { numero: 4, y: 0, hauteur: 15 },
  ]);
  assert.deepEqual(bandesTsb({ min: -5, max: 3 }, 80).map((x) => x.numero), [3]);
});

test('résumé : dernière forme, évolution du CTL, extrêmes ; null sans données', () => {
  const r = resumeForme([
    { date: '2026-11-01', ctl: 40, atl: 30, tsb: 10 },
    { date: '2026-11-02', ctl: 46, atl: 70, tsb: -24 },
    { date: '2026-11-03', ctl: 45, atl: 50, tsb: -5 },
  ]);
  assert.equal(r.derniere.date, '2026-11-03');
  assert.equal(r.ecart_ctl, 5);
  assert.equal(r.ctl_max, 46);
  assert.equal(r.tsb_min, -24);
  assert.equal(r.tsb_max, 10);
  assert.equal(resumeForme([]), null);
});

test('série limitée à la période demandée', () => {
  const s = serieForme([
    { date: '2026-10-31', ctl: 1, atl: 1, tsb: 0 },
    { date: '2026-11-01', ctl: 1, atl: 1, tsb: 0 },
    { date: '2026-11-06', ctl: 1, atl: 1, tsb: 0 },
  ], { debut: '2026-11-01', fin: '2026-11-05' });
  assert.deepEqual(s.map((f) => f.date), ['2026-11-01']);
});
