// Tests du thème d'affichage (ENF-16).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, normaliserTheme, themeEffectif, COULEUR_BARRE } from '../js/logique/theme.js';

test('trois choix : automatique, clair, sombre', () => {
  assert.deepEqual(THEMES.map((t) => t.valeur), ['auto', 'clair', 'sombre']);
});

test('normaliserTheme : valeur inconnue ou absente -> auto', () => {
  assert.equal(normaliserTheme('clair'), 'clair');
  assert.equal(normaliserTheme('sombre'), 'sombre');
  assert.equal(normaliserTheme(undefined), 'auto');
  assert.equal(normaliserTheme('bleu'), 'auto');
});

test('themeEffectif : le choix manuel passe avant le téléphone', () => {
  assert.equal(themeEffectif('auto', true), 'clair');
  assert.equal(themeEffectif('auto', false), 'sombre');
  assert.equal(themeEffectif('sombre', true), 'sombre');
  assert.equal(themeEffectif('clair', false), 'clair');
});

test('couleur de barre = fond de page', () => {
  assert.equal(COULEUR_BARRE.sombre, '#0A0B0C');
  assert.equal(COULEUR_BARRE.clair, '#F4F5F6');
});
