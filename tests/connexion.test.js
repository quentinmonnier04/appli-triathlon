// Tests de la logique de connexion (F-01, ENF-13, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerIdentifiants, enteteAuthorization } from '../js/logique/connexion.js';

test('identifiants valides : identifiant et clé renseignés', () => {
  assert.deepEqual(validerIdentifiants({ athleteId: 'i12345', cle: 'abc123' }), {});
});

test('identifiants : champs vides refusés, espaces retirés', () => {
  assert.deepEqual(Object.keys(validerIdentifiants({ athleteId: '  ', cle: '' })).sort(), ['athleteId', 'cle']);
  assert.deepEqual(validerIdentifiants({ athleteId: ' i1 ', cle: ' k ' }), {});
});

test('identifiant athlète avec espace interne refusé', () => {
  assert.ok(validerIdentifiants({ athleteId: 'i 12', cle: 'k' }).athleteId);
});

test('en-tête Basic avec utilisateur API_KEY (5.4)', () => {
  assert.equal(enteteAuthorization('ma-cle'), 'Basic ' + Buffer.from('API_KEY:ma-cle').toString('base64'));
});

import { erreurPassagere } from '../js/logique/connexion.js';
test('D-49 : erreurs passagères (réseau, 429, 5xx) réessayées, les autres non', () => {
  assert.equal(erreurPassagere({ type: 'RESEAU' }), true);
  assert.equal(erreurPassagere({ type: 'SERVEUR', statut: 429 }), true);
  assert.equal(erreurPassagere({ type: 'SERVEUR', statut: 503 }), true);
  assert.equal(erreurPassagere({ type: 'SERVEUR', statut: 404 }), false);
  assert.equal(erreurPassagere({ type: 'IDENTIFIANTS', statut: 401 }), false);
  assert.equal(erreurPassagere(null), false);
});
