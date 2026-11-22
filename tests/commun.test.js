// Tests des outils d'affichage purs de ui/commun.js (ENF-15, 9.4.4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  jourISO, decalerJour, formaterDateLongue, formaterDateCourte, echapperHtml, formaterMessage, texteBloc,
  lireRoute, formaterDistance, SPORTS,
} from '../js/ui/commun.js';

test("jourISO utilise l'heure locale", () => {
  assert.equal(jourISO(new Date(2026, 9, 27, 23, 30)), '2026-10-27');
});

test("decalerJour traverse le changement d'heure et les fins de mois", () => {
  assert.equal(decalerJour('2026-10-25', 1), '2026-10-26');
  assert.equal(decalerJour('2026-11-01', -1), '2026-10-31');
});

test('formats de date jj/mm/aaaa', () => {
  assert.equal(formaterDateLongue('2026-10-27'), 'Mardi 27/10/2026');
  assert.equal(formaterDateCourte('2026-10-27'), '27/10/2026');
});

test('echapperHtml neutralise le HTML', () => {
  assert.equal(echapperHtml('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  assert.equal(echapperHtml("l'eau & co"), 'l&#39;eau &amp; co');
});

test('messages exacts', () => {
  assert.equal(formaterMessage({ code: 'M-02', champ: 'RPE', min: '1', max: '10' }),
    'Valeur impossible : RPE doit être entre 1 et 10.');
  assert.equal(formaterMessage('M-01'), 'Le titre est obligatoire.');
  assert.equal(formaterMessage('M-05', { delai: 'jamais' }), 'Dernière sauvegarde : jamais. Sauvegarder maintenant ?');
});

test('texte des blocs', () => {
  assert.equal(texteBloc({ repetitions: 5, distance_m: 400, zone: 4, recup_s: 60 }), '5 × 400 m Z4, récup 1:00');
  assert.equal(texteBloc({ repetitions: 3, duree_s: 600, zone: 3 }), '3 × 10:00 Z3');
  assert.equal(texteBloc({ repetitions: 1, duree_s: 1200, zone: 2 }), '20:00 Z2');
});

test('lireRoute', () => {
  assert.deepEqual(lireRoute('#/aujourdhui?date=2026-10-27'), { segments: ['aujourdhui'], params: { date: '2026-10-27' } });
  assert.deepEqual(lireRoute('#/seance/abc'), { segments: ['seance', 'abc'], params: {} });
  assert.deepEqual(lireRoute(''), { segments: [], params: {} });
});

test('formaterDistance', () => {
  assert.equal(formaterDistance(10500, 'CAP'), '10,5 km');
  assert.equal(formaterDistance(1500, 'NATATION'), '1500 m');
});

test('sports de V1.1 sans enchaînement (D-05)', () => {
  assert.deepEqual(SPORTS.map((s) => s.code), ['NATATION', 'VELO', 'CAP', 'RENFO', 'REPOS']);
});

test('texte du badge de statut (E-01)', async () => {
  const { texteStatut } = await import('../js/ui/commun.js');
  assert.equal(texteStatut({ statut: 'FAITE', rpe: 6 }), 'Faite · RPE 6');
  assert.equal(texteStatut({ statut: 'PARTIELLE', rpe: 4 }), 'Partielle · RPE 4');
  assert.equal(texteStatut({ statut: 'SAUTEE', motif: 'METEO' }), 'Sautée · Météo');
});

test('ligne d\'infos d\'une carte : durée, distance, zone et repère RPE (D-02)', async () => {
  const { texteInfos } = await import('../js/ui/commun.js');
  assert.equal(texteInfos({ sport: 'CAP', duree_s: 5400, distance_m: 10500, zone_cible: 4 }), '1:30 · 10,5 km · Z4 · RPE 7-8');
  assert.equal(texteInfos({ sport: 'NATATION', distance_m: 1500 }), '1500 m');
  assert.equal(texteInfos({ sport: 'REPOS' }), '');
});
