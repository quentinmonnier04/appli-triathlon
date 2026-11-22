// Tests des messages (9.5)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGES, formaterMessage } from '../js/logique/messages.js';

test('M-01 avec le nom', () => {
  assert.equal(formaterMessage('M-01', { nom: 'Quentin' }), 'Connexion réussie : bonjour Quentin !');
});

test('textes exacts de 9.5', () => {
  assert.equal(MESSAGES['M-02'], 'Identifiants refusés. Vérifie ton identifiant athlète et ta clé API.');
  assert.equal(MESSAGES['M-06'], 'Se déconnecter ? Ta clé et le cache seront effacés de cet appareil. Tes données restent sur Intervals.icu.');
  assert.equal(MESSAGES['M-07'], 'Intervals.icu ne répond pas. Réessaie dans un instant.');
});

test('le nom est inséré tel quel (échappement fait à l\'affichage)', () => {
  assert.equal(formaterMessage('M-01', { nom: '<b>x</b>' }), 'Connexion réussie : bonjour <b>x</b> !');
});
