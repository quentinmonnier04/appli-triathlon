// Ressenti et bilan du jour (F-60 à F-63, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ECHELLE_RPE, RESSENTIS, ECHELLES_BILAN, libelleEchelle, lireNombreSaisi, validerRessenti, validerBilan, activitesSansRpe,
} from '../js/logique/ressenti.js';
import { versRessenti, convertirActivite, CHAMPS_FIL } from '../js/api/activites.js';
import { convertirBilan, versWellness } from '../js/api/wellness.js';

test('échelles : RPE 1 à 10, ressenti 1 à 5, bien-être 1 à 4', () => {
  assert.deepEqual(ECHELLE_RPE.map((e) => e.valeur), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(RESSENTIS.map((e) => e.valeur), [1, 2, 3, 4, 5]);
  for (const e of Object.values(ECHELLES_BILAN)) assert.deepEqual(e.map((x) => x.valeur), [1, 2, 3, 4]);
  assert.equal(libelleEchelle(ECHELLE_RPE, 10), 'Maximal');
  assert.equal(libelleEchelle(ECHELLE_RPE, null), null);
});

test('nombre saisi : virgule acceptée, vide = null, invalide = NaN', () => {
  assert.equal(lireNombreSaisi('72,5'), 72.5);
  assert.equal(lireNombreSaisi(' 70 '), 70);
  assert.equal(lireNombreSaisi(''), null);
  assert.ok(Number.isNaN(lireNombreSaisi('72kg')));
});

test('contrôle du ressenti (F-60, F-61)', () => {
  assert.deepEqual(validerRessenti({ rpe: 7, ressenti: 2, commentaire: 'ok' }), {});
  assert.deepEqual(validerRessenti({ rpe: null, ressenti: null }), {});
  assert.ok(validerRessenti({ rpe: 11 }).rpe);
  assert.ok(validerRessenti({ ressenti: 0 }).ressenti);
  assert.ok(validerRessenti({ commentaire: 'x'.repeat(2001) }).commentaire);
});

test('contrôle du bilan (F-62) : poids facultatif entre 20 et 300 kg', () => {
  const b = { date: '2026-11-23', fatigue: 2, sommeil: 1, douleur: null, poids_kg: null, commentaire: '' };
  assert.deepEqual(validerBilan(b), {});
  assert.deepEqual(validerBilan({ ...b, poids_kg: 72.5 }), {});
  assert.ok(validerBilan({ ...b, poids_kg: NaN }).poids_kg);
  assert.ok(validerBilan({ ...b, poids_kg: 10 }).poids_kg);
  assert.ok(validerBilan({ ...b, fatigue: 5 }).fatigue);
  assert.ok(validerBilan({ ...b, date: '23/11' }).date);
});

test('activités du jour sans RPE (F-63)', () => {
  const liste = [
    { id: 1, date: '2026-11-23', rpe: null }, { id: 2, date: '2026-11-23', rpe: 6 },
    { id: 3, date: '2026-11-22', rpe: null }, { id: 4, date: '2026-11-23' },
  ];
  assert.deepEqual(activitesSansRpe(liste, '2026-11-23').map((a) => a.id), [1, 4]);
});

test('saisie du ressenti -> corps Activity : icu_rpe, feel, description (F-60, F-61)', () => {
  assert.deepEqual(versRessenti({ rpe: 7, ressenti: 2, commentaire: 'Bonnes jambes' }), { icu_rpe: 7, feel: 2, description: 'Bonnes jambes' });
  assert.deepEqual(versRessenti({ rpe: null }), { icu_rpe: null, feel: null, description: '' });
});

test('le fil demande le RPE (F-63) ; le commentaire vient de description', () => {
  assert.ok(CHAMPS_FIL.includes('icu_rpe'));
  assert.equal(convertirActivite({ id: 'i1', description: 'Dur' }).commentaire, 'Dur');
});

test('Wellness -> Bilan, et Bilan -> corps Wellness (F-62)', () => {
  const b = convertirBilan({ id: '2026-11-23', fatigue: 2, sleepQuality: 1, soreness: 3, weight: 71.8, comments: 'RAS', ctl: 50 }, '2026-11-23');
  assert.deepEqual(b, { date: '2026-11-23', fatigue: 2, sommeil: 1, douleur: 3, poids_kg: 71.8, commentaire: 'RAS' });
  assert.deepEqual(convertirBilan(null, '2026-11-24'), { date: '2026-11-24', fatigue: null, sommeil: null, douleur: null, poids_kg: null, commentaire: '' });
  assert.deepEqual(versWellness(b), { id: '2026-11-23', fatigue: 2, sleepQuality: 1, soreness: 3, weight: 71.8, comments: 'RAS' });
});
