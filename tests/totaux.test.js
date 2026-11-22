// Totaux du tableau de bord (F-22, F-24, F-25, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalDuree, cumulParJour, comparaisonMois, sportsParJour, volumeSemaine } from '../js/logique/totaux.js';

const a = (date, sport, duree_s) => ({ id: date + sport + duree_s, date, sport, duree_s });
const activites = [
  a('2026-11-22', 'CAP', 3600), a('2026-11-20', 'VELO', 5400), a('2026-11-20', 'CAP', 1800), a('2026-11-03', 'NATATION', 2700),
  a('2026-10-30', 'VELO', 7200), a('2026-10-20', 'CAP', 3600), a('2026-10-02', 'CAP', 1200), a('2026-11-16', 'RENFO', null),
];

test('total des durées sur une période (bornes incluses, durée absente = 0)', () => {
  assert.equal(totalDuree(activites, '2026-11-01', '2026-11-22'), 3600 + 5400 + 1800 + 2700);
  assert.equal(totalDuree(activites, '2026-11-16', '2026-11-16'), 0);
});

test('cumul jour par jour', () => {
  assert.deepEqual(cumulParJour(activites, '2026-11-01', 4), [0, 0, 2700, 2700]);
});

test('mois en cours comparé au mois précédent à la même date (F-22)', () => {
  const c = comparaisonMois(activites, '2026-11-22');
  assert.equal(c.actuel_s, 13500);
  assert.equal(c.precedent_s, 1200 + 3600); // du 01/10 au 22/10
  assert.equal(c.ecart_s, 13500 - 4800);
  assert.equal(c.courbeActuelle.length, 22);
  assert.equal(c.courbePrecedente.length, 31);
  assert.equal(c.courbePrecedente[30], 12000);
  assert.equal(c.nbJours, 31);
});

test('sports de chaque jour, sans doublon (F-24)', () => {
  const s = sportsParJour(activites);
  assert.deepEqual(s['2026-11-20'], ['VELO', 'CAP']);
  assert.deepEqual(s['2026-11-22'], ['CAP']);
});

test('volume de la semaine : le repos n\'est pas un sport à comptabiliser (F-25, F-46)', () => {
  const v = volumeSemaine([{ date: '2026-11-18', sport: 'REPOS', duree_s: null }], [], '2026-11-16');
  assert.deepEqual(v, []);
});

test('volume de la semaine prévu et réalisé par sport (F-25)', () => {
  const prevues = [{ date: '2026-11-17', sport: 'CAP', duree_s: 3600 }, { date: '2026-11-21', sport: 'NATATION', duree_s: 2700 },
    { date: '2026-11-23', sport: 'CAP', duree_s: 9999 }];
  assert.deepEqual(volumeSemaine(prevues, activites, '2026-11-16'), [
    { sport: 'NATATION', prevu_s: 2700, realise_s: 0 },
    { sport: 'VELO', prevu_s: 0, realise_s: 5400 },
    { sport: 'CAP', prevu_s: 3600, realise_s: 5400 },
    { sport: 'RENFO', prevu_s: 0, realise_s: 0 },
  ]);
});
