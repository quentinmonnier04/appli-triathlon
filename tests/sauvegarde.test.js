// Tests du contrôle du format de sauvegarde (9.6, 9.7, F-36)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifierSauvegarde } from '../js/regles/validation.js';

const valide = () => ({
  app: 'triathlon-app', schema_version: 1, date_export: '2026-10-27T08:00:00Z',
  donnees: { meta: [], athletes: [], parametres: [], seances_prevues: [], realisations: [] },
});

test('sauvegarde valide acceptée', () => assert.equal(verifierSauvegarde(valide()), true));

test('fichiers incorrects rejetés', () => {
  const cas = [null, 'texte', [], {}, { ...valide(), app: 'autre' }, { ...valide(), schema_version: 2 },
    { ...valide(), schema_version: '1' }, { ...valide(), donnees: null }];
  const sansStore = valide(); delete sansStore.donnees.realisations; cas.push(sansStore);
  const pasTableau = valide(); pasTableau.donnees.meta = {}; cas.push(pasTableau);
  for (const c of cas) assert.equal(verifierSauvegarde(c), false, JSON.stringify(c));
});
