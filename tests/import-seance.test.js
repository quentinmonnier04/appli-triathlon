// Import d'une séance depuis un fichier (F-132, ENF-24) : fichiers inventés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparerImport, base64DepuisOctets } from '../js/logique/import-seance.js';

const octets = (texte) => new TextEncoder().encode(texte);

test('fichier texte (.zwo) envoyé tel quel, nom nettoyé', () => {
  const zwo = '<workout_file><name>Seuil test</name><workout><SteadyState Duration="600" Power="0.9"/></workout></workout_file>';
  const r = preparerImport('Seuil <test>.ZWO', octets(zwo));
  assert.equal(r.filename, 'Seuil _test_.ZWO');
  assert.equal(r.file_contents, zwo);
  assert.equal(r.file_contents_base64, undefined);
});

test('fichier binaire (.fit) envoyé en base64', () => {
  const r = preparerImport('seance.fit', new Uint8Array([0, 1, 2, 250, 255]));
  assert.equal(r.file_contents_base64, 'AAEC+v8=');
  assert.equal(base64DepuisOctets(new Uint8Array([104, 105])), 'aGk=');
});

test('formats inconnus, fichiers vides ou trop lourds refusés', () => {
  assert.ok(preparerImport('seance.pdf', octets('x')).erreur);
  assert.ok(preparerImport('seance', octets('x')).erreur);
  assert.ok(preparerImport('seance.erg', new Uint8Array(0)).erreur);
  assert.ok(preparerImport('seance.mrc', new Uint8Array(1000001)).erreur);
});
