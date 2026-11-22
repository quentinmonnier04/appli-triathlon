// Tests de la validation des séances prévues et des réalisations (ENF-20, C-14, règle 4.5.2)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validerSeancePrevue, validerRealisation, normaliserRealisation } from '../js/regles/validation.js';

test('séance prévue : titre obligatoire (M-01) puis valide', () => {
  assert.equal(validerSeancePrevue({ titre: '  ', sport: 'CAP' }).erreurs.titre.code, 'M-01');
  assert.equal(validerSeancePrevue({ titre: 'Footing', sport: 'CAP', duree_s: 3600 }).ok, true);
});

test('séance prévue : titre de plus de 60 caractères refusé', () => {
  assert.equal(validerSeancePrevue({ titre: 'x'.repeat(61), sport: 'CAP' }).erreurs.titre.code, 'M-02');
});

test('séance prévue : durée de 13 h refusée', () => {
  assert.equal(validerSeancePrevue({ titre: 'Long', sport: 'VELO', duree_s: 46800 }).erreurs.duree_s.code, 'M-02');
});

test('séance prévue : bloc à 51 répétitions refusé', () => {
  const r = validerSeancePrevue({ titre: 'VMA', sport: 'CAP', segments: [{ ordre: 1, sport: 'CAP', blocs: [{ repetitions: 51, distance_m: 400 }] }] });
  assert.equal(r.erreurs['blocs.0.repetitions'].code, 'M-02');
});

test('réalisation FAITE : durée et RPE obligatoires', () => {
  const r = validerRealisation({ statut: 'FAITE', sport: 'CAP' });
  assert.equal(r.erreurs.duree_s.code, 'M-10');
  assert.equal(r.erreurs.rpe.code, 'M-10');
});

test('réalisation SAUTEE : motif obligatoire, mesures retirées', () => {
  assert.equal(validerRealisation({ statut: 'SAUTEE', sport: 'CAP' }).erreurs.motif.code, 'M-10');
  const n = normaliserRealisation({ statut: 'SAUTEE', motif: 'METEO', sport: 'CAP', rpe: 5, duree_s: 600, commentaire: 'pluie' });
  assert.deepEqual(n, { statut: 'SAUTEE', motif: 'METEO', sport: 'CAP', commentaire: 'pluie' });
});

test('puissance retirée hors vélo, FC 231 refusée', () => {
  assert.equal(normaliserRealisation({ statut: 'FAITE', sport: 'CAP', puissance_moy_w: 200 }).puissance_moy_w, undefined);
  assert.equal(validerRealisation({ statut: 'FAITE', sport: 'CAP', duree_s: 600, rpe: 5, fc_moy: 231 }).erreurs.fc_moy.code, 'M-02');
});

test('douleur : intensité hors 1-5 refusée, réalisation complète valide', () => {
  const base = { statut: 'FAITE', sport: 'CAP', duree_s: 3000, rpe: 6 };
  assert.equal(validerRealisation({ ...base, douleur: { zone: 'Genou', intensite: 6 } }).erreurs.douleur.code, 'M-02');
  assert.equal(validerRealisation({ ...base, distance_m: 10000, fc_moy: 150, douleur: { zone: 'Genou', intensite: 3 } }).ok, true);
});
