// Tests des conversions de la couche api/ (ENF-25, 9.2, 5.4)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertirAthlete } from '../js/api/athlete.js';
import { typeErreurHttp } from '../js/api/client.js';

test('athlète : nom repris du champ name', () => {
  assert.deepEqual(convertirAthlete({ id: 'i42', name: 'Quentin M', firstname: 'Quentin', sportSettings: [] }), { id: 'i42', nom: 'Quentin M' });
});

test('athlète : repli sur prénom et nom, puis texte par défaut', () => {
  assert.equal(convertirAthlete({ id: 'i1', firstname: 'Ana', lastname: 'Bo' }).nom, 'Ana Bo');
  assert.equal(convertirAthlete({ id: 'i1' }).nom, 'athlète');
});

test('erreurs HTTP : 401 et 403 = identifiants refusés, le reste = serveur', () => {
  assert.equal(typeErreurHttp(401), 'IDENTIFIANTS');
  assert.equal(typeErreurHttp(403), 'IDENTIFIANTS');
  assert.equal(typeErreurHttp(404), 'SERVEUR');
  assert.equal(typeErreurHttp(500), 'SERVEUR');
  assert.equal(typeErreurHttp(429), 'SERVEUR');
});
