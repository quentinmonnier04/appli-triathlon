// Cohérence de VERSION (sw.js) et VERSION_APP, fichiers mis en cache existants (0.4, 5.7)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION_APP } from '../js/version.js';

const sw = () => readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

test('VERSION (sw.js) = VERSION_APP', () => {
  assert.equal(sw().match(/const VERSION = '([^']+)'/)[1], VERSION_APP);
});

test('tous les fichiers listés dans sw.js existent', () => {
  const liste = [...sw().matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
  assert.ok(liste.length > 0);
  for (const f of liste) assert.doesNotThrow(() => readFileSync(new URL('../' + f, import.meta.url)), f);
});
