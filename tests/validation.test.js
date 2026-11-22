// Tests des bornes de saisie (ENF-20, 9.4.4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifierBorne } from '../js/regles/validation.js';

test('bornes ENF-20 : valeurs limites acceptées', () => {
  for (const [cle, v] of [['rpe', 1], ['rpe', 10], ['fc', 30], ['fc', 230], ['puissance', 0], ['puissance', 2000],
    ['duree', 60], ['duree', 43200], ['distance', 1], ['distance', 300000], ['repetitions', 1], ['repetitions', 50]]) {
    assert.equal(verifierBorne(cle, v), null, `${cle}=${v}`);
  }
});

test('bornes ENF-20 : valeurs juste hors bornes refusées (M-02)', () => {
  for (const [cle, v] of [['rpe', 0], ['rpe', 11], ['fc', 29], ['fc', 231], ['puissance', -1], ['puissance', 2001],
    ['duree', 59], ['duree', 43201], ['distance', 0], ['distance', -5], ['distance', 300001], ['repetitions', 0], ['repetitions', 51]]) {
    assert.equal(verifierBorne(cle, v)?.code, 'M-02', `${cle}=${v}`);
  }
});

test('M-02 porte le libellé et les bornes affichables', () => {
  assert.deepEqual(verifierBorne('rpe', 11), { code: 'M-02', champ: 'RPE', min: '1', max: '10' });
});

test("valeur absente : pas d'erreur de borne ; RPE décimal refusé", () => {
  assert.equal(verifierBorne('rpe', null), null);
  assert.equal(verifierBorne('rpe', 5.5)?.code, 'M-02');
});
