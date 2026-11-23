// Objectif course A (F-80, ENF-24)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertirObjectif, versEvenementObjectif, SPORTS_OBJECTIF } from '../js/api/objectif.js';
import { convertirSeancePrevue, estAffichable } from '../js/api/evenements.js';
import { joursEntre } from '../js/logique/dates.js';
import { volumeSemaine } from '../js/logique/totaux.js';
import { validerObjectif } from '../js/logique/plan.js';

test('objectif -> événement RACE_A et retour (triathlon = type Transition)', () => {
  const o = { nom: "Triathlon d'Annecy", date: '2027-06-14', sport: 'ENCHAINEMENT' };
  const corps = versEvenementObjectif(o);
  assert.deepEqual(corps, { category: 'RACE_A', start_date_local: '2027-06-14T00:00:00', name: "Triathlon d'Annecy", type: 'Transition' });
  assert.deepEqual(convertirObjectif({ id: 55, ...corps }), { id: '55', ...o });
  assert.equal(convertirObjectif({ id: 1, start_date_local: '2027-04-04T00:00:00', type: 'Run' }).sport, 'CAP');
  assert.deepEqual(SPORTS_OBJECTIF, ['ENCHAINEMENT', 'CAP', 'VELO', 'NATATION']);
});

test('compte à rebours en jours', () => {
  assert.equal(joursEntre('2026-11-23', '2027-06-14'), 203);
  assert.equal(joursEntre('2026-11-23', '2026-11-23'), 0);
});

test('la course apparaît dans l\'agenda, sans volume', () => {
  assert.equal(estAffichable({ category: 'RACE_A' }), true);
  const s = convertirSeancePrevue({ id: 5, category: 'RACE_A', start_date_local: '2026-11-25T00:00:00', name: 'Course', type: 'Run' });
  assert.equal(s.objectif, true);
  assert.equal(s.duree_s, null);
  assert.equal(s.blocs, null);
  const r = volumeSemaine([s, { date: '2026-11-24', sport: 'CAP', duree_s: 3600 }], [], '2026-11-23');
  assert.deepEqual(r, [{ sport: 'CAP', prevu_s: 3600, realise_s: 0 }]);
});

test('validation de l\'objectif', () => {
  const ok = { nom: 'Course', date: '2027-06-14', sport: 'CAP' };
  assert.deepEqual(validerObjectif(ok, '2026-11-23'), {});
  assert.ok(validerObjectif({ ...ok, nom: ' ' }, '2026-11-23').nom);
  assert.ok(validerObjectif({ ...ok, date: '2026-11-20' }, '2026-11-23').date);
  assert.ok(validerObjectif({ ...ok, sport: 'RENFO' }, '2026-11-23').sport);
});
