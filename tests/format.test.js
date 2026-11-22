// Tests du formatage de texte (ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { echapperHtml } from '../js/logique/format.js';

test('echapperHtml neutralise le HTML venant de l\'API', () => {
  assert.equal(echapperHtml('<img src=x onerror="a()">'), '&lt;img src=x onerror=&quot;a()&quot;&gt;');
  assert.equal(echapperHtml("l'eau & co"), 'l&#39;eau &amp; co');
  assert.equal(echapperHtml(null), '');
});
